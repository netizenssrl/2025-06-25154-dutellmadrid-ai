const mysql2 = require('mysql2');
const fs = require("fs");

const dbHost = 'dbintramed.mysql.database.azure.com';
const dbUser = 'intramedadmin';
const dbPass = 'SjPGRdIqZ_gKUvvF60nvbqzO8dgqPcxQ';
const ssl = { 
    rejectUnauthorized: false,
    ca: fs.readFileSync(__dirname + '/BaltimoreCyberTrustRoot.crt.pem') 
};
/* const dbHost = 'localhost';
const dbUser = 'root';
const dbPass = 'N3t1z3ns.';
const ssl = false; */

const dbName = 'db_dutell2025_madrid_ai';
// create connection
const dbOptions = {
    host: dbHost,
    database: dbName,
    user: dbUser,
    password: dbPass,
    port: 3306,
    ssl: ssl
};
const conn = mysql2.createConnection(dbOptions);

const db = mysql2.createPool(dbOptions);
const promiseDB = db.promise();

module.exports = {conn, promiseDB};