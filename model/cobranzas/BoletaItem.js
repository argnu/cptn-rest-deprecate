const connector = require('../../connector');
const sql = require('sql');
sql.setDialect('postgres');

const table = sql.define({
    name: 'boleta_item',
    columns: [{
            name: 'id',
            dataType: 'serial',
            primaryKey: true
        },
        {
            name: 'boleta',
            dataType: 'int',
            notNull: true
        },
        {
            name: 'item',
            dataType: 'int',
            notNull: true
        },
        {
            name: 'descripcion',
            dataType: 'varchar(255)',
        },
        {
            name: 'importe',
            dataType: 'float',
        }
    ],

    foreignKeys: [{
            table: 'boleta',
            columns: ['boleta'],
            refColumns: ['id']
        },
    ]
});

module.exports.table = table;