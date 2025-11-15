/**
 * Created by Christos Ploutarchou
 * Project : node_rest_api_with_mysql
 * Filename : Post.model.js 
 * Date: 04/04/2020
 * Time: 00:01
 **/
module.exports = (database, Sequelize) => {
    // Renamed model to 'post' for clarity and consistency with API naming
    return database.define("post", {
        title: {
            type: Sequelize.STRING,
            allowNull: false // Added a constraint: Title should not be empty
        },
        description: {
            type: Sequelize.TEXT
        },
        published: {
            type: Sequelize.BOOLEAN,
            defaultValue: false // Added a default value
        },
        publisher: {
            type: Sequelize.STRING
        }
    });
};