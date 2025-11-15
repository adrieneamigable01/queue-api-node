// models/Post.model.js

/**
 * Created by Christos Ploutarchou
 * Project : node_rest_api_with_mysql
 * Filename : Post.model.js 
 * Date: 04/04/2020
 * Time: 00:01
 **/
module.exports = (database, Sequelize) => {
    // Defines the table/model name as 'post'. 
    // Sequelize will look for or create a database table named 'posts'.
    return database.define("post", {
        title: {
            type: Sequelize.STRING,
            allowNull: false // Title should be mandatory
        },
        description: {
            type: Sequelize.TEXT
        },
        published: {
            type: Sequelize.BOOLEAN,
            defaultValue: false // Sets the default state to unpublished
        },
        publisher: {
            type: Sequelize.STRING
        }
    });
};