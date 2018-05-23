const connector = require('../../db/connector');
const model = require('../../model');

function getVolantesVencidos() {
    let table = model.VolantePago.table;
    let query = table.select(table.id)
                     .where(
                        table.fecha_vencimiento.lt(moment()),
                        table.pagado.equals(false)
                     ).toQuery();

    return connector.execQuery(query).then(r => r.rows);
}


let connection;
let volantes = [];

getVolantesVencidos()
.then(vols => {
    volantes = vols;
    return Promise.all(volantes.map(v => model.VolantePago.getBoletas(v.id)))
})
.then(volantes_boletas => {
    return connector.beginTransaction()
    .then(con => {
        connection = con;
        //Actualización de Boletas, Estado 1 es 'Pendiente de Pago'
        return Promise.all(volantes_boletas.map(b => model.Boleta.patch(b.id, { estado: 1 }, connection.client)))
    })
    .then(r => Promise.all(volantes.map(v => model.VolantePago.patch(v.id, { eliminado: true }, connection.client))))
    .then(r => connector.commit(connection.client).then(r => connection.done()))
    .catch(e => {
        connector.rollback(connection.client);
        connection.done();
        return Promise.reject(e);
    })
})
.then(r => {
    console.info("Boletas de Volantes de Pago vencidos actualizadas a 'Pendiente de Pago'");
    process.exit();
})
.catch(e => {
    console.error("Error actualizando boletas con volante de pago vencido");
    console.error(e);
    process.exit();
})