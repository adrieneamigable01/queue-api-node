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

/**
 * =============================
 * GET ACTIVE VIDEO ADS
 * =============================
 */
exports.getActiveVideoAds = async (req, res) => {
  try {
    const { datetime } = getPHDateTime();

    const ads = await db.databaseConf.query(
      `
      SELECT *
      FROM video_ads
      ORDER BY video_ads_id DESC
      `,
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    return res.status(200).json({
      isError: false,
      message: ads.length ? "Success" : "No data",
      data: ads,
      date: datetime,
    });

  } catch (err) {
    console.error("getActiveVideoAds:", err);
    return res.status(500).json({
      isError: true,
      message: err.message,
      data: [],
      date: getPHDateTime().datetime,
    });
  }
};

/**
 * =============================
 * CREATE VIDEO AD
 * =============================
 */
exports.createVideoAd = async (req, res) => {
  const t = await db.databaseConf.transaction();

  try {
    const { title, video_url,is_list, is_active = 1 } = req.body;

    if (!title || !video_url) {
      return res.status(400).json({
        status: "error",
        message: "Required parameters are missing.",
      });
    }

    const { datetime } = getPHDateTime();

    // 🔴 STEP 1: Deactivate ALL existing videos
    await db.databaseConf.query(
      `
      UPDATE video_ads
      SET is_active = 0
      `,
      {
        type: Sequelize.QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // 🟢 STEP 2: Insert new active video
    const [insertId] = await db.databaseConf.query(
      `
      INSERT INTO video_ads (title, video,isList, is_active, created_at)
      VALUES (:title, :video_url,:is_list, :is_active, :created_at)
      `,
      {
        replacements: {
          title,
          video_url,
          is_list,
          is_active: 1, // always active for new video
          created_at: datetime,
        },
        type: Sequelize.QueryTypes.INSERT,
        transaction: t,
      }
    );

    // ✅ COMMIT TRANSACTION
    await t.commit();

    // 🔌 SOCKET EMIT (send event name only)
    const io = req.app.get("io");
    io.emit("VideoAds:created");

    return res.status(201).json({
      status: "success",
      message: "Video ad created successfully",
      video_ads_id: insertId,
    });

  } catch (err) {
    await t.rollback();
    console.error("createVideoAd:", err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};


/**
 * =============================
 * UPDATE VIDEO AD STATUS
 * =============================
 */
exports.updateVideoAdStatus = async (req, res) => {
  const t = await db.databaseConf.transaction();

  try {
    const { video_ads_id, is_active } = req.body;

    if (video_ads_id === undefined || is_active === undefined) {
      return res.status(400).json({
        status: "error",
        message: "Missing parameters",
      });
    }

    const [affectedRows] = await db.databaseConf.query(
      `
      UPDATE video_ads
      SET is_active = :active
      WHERE video_ads_id = :id
      `,
      {
        replacements: {
          id: video_ads_id,
          active: is_active,
        },
        type: Sequelize.QueryTypes.UPDATE,
        transaction: t,
      }
    );

    if (affectedRows === 0) {
      await t.rollback();
      return res.status(404).json({
        status: "error",
        message: "Video ad not found",
      });
    }

    await t.commit();

    // 🔴 FETCH UPDATED ACTIVE ADS
    const activeAds = await db.databaseConf.query(
      `
      SELECT *
      FROM video_ads
      WHERE is_active = 1
      `,
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    // 🔌 SOCKET EMIT (REALTIME)
    const io = req.app.get("io");
    io.emit("VideoAds:updated", activeAds);

    return res.status(200).json({
      status: "success",
      message: "Video ad status updated",
    });

  } catch (err) {
    await t.rollback();
    console.error("updateVideoAdStatus:", err);

    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};
