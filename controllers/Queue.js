const db = require("../models");
const Sequelize = db.Sequelize;

/**
 * 🇵🇭 Get Philippines Date & DateTime
 */
function getPHDateTime() {
  const ph = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );

  const pad = (n) => String(n).padStart(2, "0");

  const date =
    `${ph.getFullYear()}-${pad(ph.getMonth() + 1)}-${pad(ph.getDate())}`;

  const datetime =
    `${date} ${pad(ph.getHours())}:${pad(ph.getMinutes())}:${pad(ph.getSeconds())}`;

  return { date, datetime };
}



exports.getQueuesToday = async (req, res) => {
  try {
    // 🇵🇭 PH DATE
    const { date: today, datetime: nowPH } = getPHDateTime();
    console.log("PH Today:", today);

    // =============================
    // FETCH QUEUE LIST
    // =============================
    const queues = await db.databaseConf.query(
      `
      SELECT 
        q.queue_id, 
        q.queue_number, 
        q.name,
        q.purpose,
        q.queue_type, 
        q.date, 
        s.status, 
        s.teller_number, 
        s.isAnnounce, 
        q.is_queue_announce, 
        s.serving_start_time,
        s.serving_end_time, 
        s.serving_id
      FROM queue AS q
      LEFT JOIN serving AS s 
        ON q.queue_id = s.queue_id
      WHERE q.is_active = 1
        AND DATE(q.date) = :today
      ORDER BY q.queue_number ASC
      `,
      {
        replacements: { today },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const normalizedQueues = queues.map(q => ({
      ...q,
      status: q.status ?? "WAITING",
    }));

    // =============================
    // FETCH QUEUE SYSTEM STATUS
    // =============================
    const queStatusResult = await db.databaseConf.query(
      `SELECT queue_status FROM queue_status LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const queueStatus =
      queStatusResult.length > 0
        ? queStatusResult[0].queue_status
        : "No status available";

    return res.status(200).json({
      isError: false,
      que_status: queueStatus,
      message: normalizedQueues.length ? "Success" : "No data",
      data: normalizedQueues,
      date: nowPH,
    });

  } catch (error) {
    return res.status(500).json({
      isError: true,
      message: error.message || "Failed to fetch queue",
      data: [],
      date: getPHDateTime().datetime,
    });
  }
};


exports.createQueue = async (req, res) => {
  try {
    const { queue_type, name, purpose } = req.body;

    if (!queue_type || !name) {
      return res.status(400).json({
        status: "error",
        message: "Required parameters are missing: queue_type or name",
      });
    }

    const { date: today, datetime: dateNow } = getPHDateTime();

    // =============================
    // CHECK QUEUE STATUS
    // =============================
    const queStatusResult = await db.databaseConf.query(
      `SELECT queue_status FROM queue_status LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const queueStatus =
      queStatusResult.length > 0
        ? queStatusResult[0].queue_status
        : "Closed";

    if (queueStatus !== "Open") {
      return res.status(400).json({
        status: "error",
        message: "Time already Cut-Off, Please inquire inside",
      });
    }

    // =============================
    // GET NEXT QUEUE NUMBER (TODAY)
    // =============================
    const maxQueueResult = await db.databaseConf.query(
      `SELECT MAX(queue_number) AS max_queue_number 
       FROM queue WHERE DATE(date) = :today`,
      {
        replacements: { today },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const queueNumber = (maxQueueResult[0].max_queue_number || 0) + 1;

    // =============================
    // INSERT QUEUE
    // =============================
    const [insertId] = await db.databaseConf.query(
      `
      INSERT INTO queue 
        (queue_number, queue_type, purpose, name, date, is_active)
      VALUES 
        (:queue_number, :queue_type, :purpose, :name, :date, 1)
      `,
      {
        replacements: {
          queue_number: queueNumber,
          queue_type,
          purpose: purpose || "",
          name,
          date: dateNow,
        },
        type: Sequelize.QueryTypes.INSERT,
      }
    );

    // =============================
    // SOCKET EMIT
    // =============================
    const io = req.app.get("io");
    io.emit("Queue:created", {
      queue_id: insertId,
      queue_number: queueNumber,
      queue_type,
      name,
      purpose,
      date: dateNow,
      status: "WAITING",
      teller_number: null,
      isAnnounce: 0,
      is_queue_announce: 0,
      serving_start_time: null,
      serving_end_time: null,
      serving_id: null,
    });

    return res.status(201).json({
      status: "success",
      message: "New queue added successfully.",
      queue_number: queueNumber,
    });

  } catch (error) {
    console.error("Error creating queue:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create new queue",
    });
  }
};


exports.createServing = async (req, res) => {
  const t = await db.databaseConf.transaction();

  try {
    const { queue_id, teller_number } = req.body;

    if (!queue_id || !teller_number) {
      return res.status(400).json({
        status: "error",
        message: "Missing parameters",
      });
    }

    const { datetime } = getPHDateTime();
    const timeNow = datetime.slice(11, 19);

    // 🔴 1. FIND ACTIVE SERVING FOR TELLER
    const previous = await db.databaseConf.query(
      `
      SELECT * FROM serving
      WHERE teller_number = :teller
        AND status = 'Pending'
      ORDER BY serving_id DESC
      LIMIT 1
      `,
      {
        replacements: { teller: teller_number },
        type: Sequelize.QueryTypes.SELECT,
        transaction: t,
      }
    );

    // 🔴 2. CLOSE PREVIOUS SERVING
    if (previous.length > 0) {
      await db.databaseConf.query(
        `
        UPDATE serving
        SET status = 'Done',
            serving_end_time = :time
        WHERE serving_id = :id
        `,
        {
          replacements: {
            id: previous[0].serving_id,
            time: timeNow,
          },
          type: Sequelize.QueryTypes.UPDATE,
          transaction: t,
        }
      );
    }

    // 🟢 3. INSERT NEW SERVING
    const [insertId] = await db.databaseConf.query(
      `
      INSERT INTO serving (queue_id, teller_number, status, serving_start_time)
      VALUES (:queue, :teller, 'Pending', :time)
      `,
      {
        replacements: {
          queue: queue_id,
          teller: teller_number,
          time: timeNow,
        },
        type: Sequelize.QueryTypes.INSERT,
        transaction: t,
      }
    );

    await t.commit();

    // 🔵 4. FETCH ONLY LATEST SERVING PER QUEUE
    const [latest] = await db.databaseConf.query(
      `
      SELECT
        q.queue_id,
        q.queue_number,
        q.name,
        q.purpose,
        q.queue_type,
        q.date,
        s.status,
        s.teller_number,
        s.serving_start_time,
        s.serving_end_time,
        s.serving_id
      FROM queue q
      JOIN serving s ON s.queue_id = q.queue_id
      WHERE s.serving_id = (
        SELECT MAX(serving_id)
        FROM serving
        WHERE queue_id = q.queue_id
      )
      AND q.queue_id = :queue
      `,
      {
        replacements: { queue: queue_id },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const io = req.app.get("io");

    // 🔴 EMIT DONE (PREVIOUS)
    if (previous.length > 0) {
      io.emit("Queue:updated", {
        ...previous[0],
        status: "Done",
      });
    }

    // 🟢 EMIT NEW PENDING
    io.emit("Queue:created", latest);

    return res.status(201).json({
      status: "success",
      data: latest,
    });

  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};


exports.updateQueueAnnounce = async (req, res) => {
  const t = await db.databaseConf.transaction();

  try {
    const { queue_id, is_queue_announce } = req.body;

    // 🔴 VALIDATION (same as PHP isset checks)
    if (queue_id === undefined || is_queue_announce === undefined) {
      return res.status(400).json({
        status: "error",
        message: "Required parameters are missing.",
      });
    }

    // 🔵 UPDATE queue.is_queue_announce
    const [affectedRows] = await db.databaseConf.query(
      `
      UPDATE queue
      SET is_queue_announce = :announce
      WHERE queue_id = :queue
      `,
      {
        replacements: {
          announce: is_queue_announce,
          queue: queue_id,
        },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: t,
      }
    );

    await t.commit();

    if (affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "Queue not found or no changes made.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Announcement status updated.",
    });

  } catch (err) {
    await t.rollback();
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

// Node.js version of your PHP serving-done endpoint
exports.markServingDone = async (req, res) => {
const io = req.app.get("io");
  const t = await db.databaseConf.transaction();

  try {
    const { queue_id, teller_number } = req.body;

    if (!queue_id || !teller_number) {
      return res.status(400).json({ status: "error", message: "Required parameters are missing." });
    }

    const timeNow = new Date().toLocaleTimeString("en-PH", { hour12: false });

    const activeServing = await db.databaseConf.query(
      `
      SELECT *
      FROM serving
      WHERE teller_number = :teller
        AND queue_id = :queue
        AND status != 'Done'
      LIMIT 1
      `,
      {
        replacements: { teller: teller_number, queue: queue_id },
        type: Sequelize.QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (activeServing.length === 0) {
      if (!t.finished) await t.rollback();
      return res.status(404).json({ status: "error", message: "This teller is not serving the specified queue." });
    }

    await db.databaseConf.query(
      `
      UPDATE serving
      SET status = 'Done', serving_end_time = :time
      WHERE teller_number = :teller
        AND queue_id = :queue
        AND status != 'Done'
      `,
      {
        replacements: { teller: teller_number, queue: queue_id, time: timeNow },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: t,
      }
    );

    await t.commit();

    // Emit socket event
    if (io) {
      io.emit("Queue:updated", { queue_id, teller_number, status: "Done" });
    }

    return res.status(200).json({ status: "success", message: "Serving done successfully." });

  } catch (err) {
    if (t && !t.finished) await t.rollback();
    console.error(err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};


// Node.js version of your PHP isAnnounce update endpoint
exports.updateServingQueueAnnouceStatus = async (req, res) => {
  const t = await db.databaseConf.transaction(); // Start transaction

  try {
    const { serving_id, isAnnounce } = req.body;

    // 🔴 Validate required parameters
    if (serving_id === undefined || isAnnounce === undefined) {
      await t.rollback();
      return res.status(400).json({
        status: "error",
        message: "Required parameters are missing.",
      });
    }

    // 🔵 Update isAnnounce field
    const [affectedRows] = await db.databaseConf.query(
      `
      UPDATE serving
      SET isAnnounce = :isAnnounce
      WHERE serving_id = :serving_id
      `,
      {
        replacements: {
          serving_id,
          isAnnounce,
        },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: t,
      }
    );

    if (affectedRows === 0) {
      await t.rollback();
      return res.status(404).json({
        status: "error",
        message: "Serving record not found.",
      });
    }

    await t.commit();

    return res.status(200).json({
      status: "success",
      message: "Announcement status updated.",
    });
  } catch (err) {
    await t.rollback();
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};


