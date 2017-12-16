const connector = require('../../connector');
const sql = require('sql');
sql.setDialect('postgres');

const table = sql.define({
    name: 'comprobante_pago',
    columns: [{
            name: 'id',
            dataType: 'serial',
            primaryKey: true
        },
        {
            name: 'comprobante',
            dataType: 'int',
            notNull: true
        },
        {
            name: 'item',
            dataType: 'int',
        },
        {
            name: 'fecha_pago',
            dataType: 'date',
        },
        {
            name: 'importe',
            dataType: 'float',
        },
        {
            name: 'forma_pago',
            dataType: 'int'
        },
        {
            name: 'numero_cheque',
            dataType: 'int'
        },
        {
            name: 'codigo_banco',
            dataType: 'int'
        },
        {
            name: 'titular_cuenta',
            dataType: 'varchar(255)'
        },
        {
            name: 'fecha_vto_cheque',
            dataType: 'date'
        },
        {
            name: 'compensado',
            dataType: 'int'
        }



    ],

    foreignKeys: [{
            table: 'comprobante',
            columns: ['comprobante'],
            refColumns: ['id']
        },
        {
            table: 't_formapago',
            columns: ['forma_pago'],
            refColumns: ['id']
        }
    ]
});

module.exports.table = table;

module.exports.getByComprobante = function (id) {
    let query = table.select(table.star())
        .from(table)
        .where(table.comprobante.equals(id))
        .toQuery();

    return connector.execQuery(query)
        .then(r => r.rows);
}

module.exports.add = function(comprobante_pago, client) {
    let query = table.insert(
            table.comprobante.value(comprobante_pago.comprobante),
            table.item.value(comprobante_pago.item),
            table.fecha_pago.value(comprobante_pago.fecha_pago),
            table.importe.value(comprobante_pago.importe),
            table.forma_pago.value(comprobante_pago.forma_pago),
            table.numero_cheque.value(comprobante_pago.numero_cheque),
            table.codigo_banco.value(comprobante_pago.codigo_banco)
        )
        .returning(table.id, table.numero)
        .toQuery()

    return connector.execQuery(query, client)
        .then(r => r.rows[0]);

}