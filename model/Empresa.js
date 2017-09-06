const connector = require('../connector');
const Domicilio = require('./Domicilio');
const Entidad = require('./Entidad');
const Contacto = require('./Contacto');
const sql = require('sql');
sql.setDialect('postgres');


const table = sql.define({
  name: 'empresa',
  columns: [
    {
      name: 'id',
      dataType: 'int',
      primaryKey: true
    },
    {
      name: 'nombre',
      dataType: 'varchar(100)',
      notNull: true
    },
    {
      name: 'fechaInicio',
      dataType: 'date'
    },
    {
      name: 'tipoEmpresa',
      dataType: 'int'
    },
    {
      name: 'tipoSociedad',
      dataType: 'int'
    },
    {
      name: 'fechaConstitucion',
      dataType: 'date'
    }
  ],

  foreignKeys: [
    {
      table: 'entidad',
      columns: [ 'id' ],
      refColumns: [ 'id' ]
    },
    {
      table: 'tipoempresa',
      columns: [ 'tipoEmpresa' ],
      refColumns: [ 'id' ]
    },
    {
      table: 'tiposociedad',
      columns: [ 'tipoSociedad' ],
      refColumns: [ 'id' ]
    }
  ]
});

module.exports.table = table;

function addEmpresa(client, empresa) {

  function addDatosBasicos(empresa) {
    let query = table.insert(
      table.id.value(empresa.id),
      table.nombre.value(empresa.nombre),
      table.fechaInicio.value(empresa.fechaInicio),
      table.fechaConstitucion.value(empresa.fechaConstitucion),
      table.tipoEmpresa.value(empresa.tipoEmpresa),
      table.tipoSociedad.value(empresa.tipoSociedad)
    )
    .returning(
      table.id, table.nombre, table.fechaInicio,
      table.fechaConstitucion, table.tipoEmpresa,
      table.tipoSociedad
    )
    .toQuery();

    return connector.execQuery(query, client);
  }

  return Entidad.addEntidad(client, {
    cuit: empresa.cui,
    condafip: empresa.condafip,
    domicilioReal: empresa.domicilioReal,
    domicilioLegal: empresa.domicilioLegal
  })
  .then(entidad => {
    empresa.id = entidad.id;
    return addDatosBasicos(empresa)
          .then(r => {
            let empresa_added = r.rows[0];
            let proms_contactos = empresa.contactos.map(c => {
              c.entidad = empresa_added.id;
              return Contacto.addContacto(client, c);
            });

            return Promise.all(proms_contactos)
            .then(contactos => {
              empresa_added.contactos = contactos;
              return empresa_added;
            });
          });
  })
}

module.exports.addEmpresa = addEmpresa;

module.exports.add = function(empresa) {
  return new Promise(function(resolve, reject) {
    connector
    .beginTransaction()
    .then(connection => {
      addempresa(connection.client, empresa)
        .then(empresa_added => {
          connector
          .commit(connection.client)
          .then(r => {
            connection.done();
            resolve(empresa_added);
          });
        })
        .catch(e => {
          connector.rollback(connection.client);
          connection.done();
          reject(e);
        });
    })
  });
}


const select_atributes = [table.id, table.nombre, table.fechaInicio,
table.fechaConstitucion, table.tipoEmpresa, table.tipoSociedad,
Entidad.table.condafip, Entidad.table.cuit,
Entidad.table.domicilioReal.as('domicilioReal'),
Entidad.table.domicilioLegal.as('domicilioLegal')];
const select_from = table.join(Entidad.table).on(table.id.equals(Entidad.table.id));

module.exports.getAll = function() {
  let empresas = [];
  let query = table.select(...select_atributes)
  .from(select_from)
  .toQuery();

  return connector.execQuery(query)
  .then(r => {
    empresas = r.rows;
    let proms = []
    for(let empresa of empresas) {
      proms.push(getDatosEmpresa(empresa));
    }
    return Promise.all(proms);
  })
  .then(rs => {
    rs.forEach((value, index) => {
      [ domicilioReal, domicilioLegal, contactos ] = value;
      empresas[index].domicilioReal = domicilioReal;
      empresas[index].domicilioLegal = domicilioLegal;
      empresas[index].contactos = contactos;
    });
    return empresas;
  })
}


function getDatosEmpresa(empresa) {
  return Promise.all([
      Domicilio.getDomicilio(empresa.domicilioReal),
      Domicilio.getDomicilio(empresa.domicilioLegal),
      Contacto.getAll(empresa.id)
    ]);
}

module.exports.get = function(id) {
  let empresa = {};
  let query = table.select(...select_atributes)
  .from(select_from)
  .where(table.id.equals(id))
  .toQuery();

  return connector.execQuery(query)
  .then(r => {
    empresa = r.rows[0];
    return getDatosEmpresa(empresa);
  })
  .then(([ domicilioReal, domicilioLegal, contactos ]) => {
      empresa.domicilioReal = domicilioReal;
      empresa.domicilioLegal = domicilioLegal;
      empresa.contactos = contactos;
      return empresa;
  });
}