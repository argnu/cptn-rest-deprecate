const connector = require('../connector');
const sql = require('sql');
sql.setDialect('postgres');
const Profesional = require('./profesional/Profesional');
const Empresa = require('./Empresa');

const table = sql.define({
  name: 'solicitud',
  columns: [
    {
      name: 'id',
      dataType: 'serial',
      primaryKey: true
    },
    {
      name: 'fecha',
      dataType: 'date',
      notNull: true
    },
    {
      name: 'estado',
      dataType: 'varchar(45)',
      notNull: true
    },
    {
      name: 'exencionArt10',
      dataType: 'boolean',
      notNull: true,
      defaultValue: false
    },
    {
      name: 'exencionArt6',
      dataType: 'boolean',
      notNull: true,
      defaultValue: false
    },
    {
      name: 'delegacion',
      dataType: 'int',
      notNull: true
    },
    {
      name: 'entidad',
      dataType: 'int'
    },
    {
      name: 'tipoEntidad',
      dataType: 'varchar(20)'
    }
  ],

  foreignKeys: [
    {
      table: 'delegacion',
      columns: [ 'delegacion' ],
      refColumns: [ 'id' ]
    },
    {
      table: 'entidad',
      columns: [ 'entidad' ],
      refColumns: [ 'id' ]
    },
  ]
});

module.exports.table = table;

function addSolicitud(client, solicitud) {
  let query = table.insert(
    table.fecha.value(solicitud.fecha),
    table.estado.value('pendiente'),
    table.delegacion.value(solicitud.delegacion),
    table.entidad.value(solicitud.entidad.id),
    table.tipoEntidad.value(solicitud.tipoEntidad)
  ).returning(table.id, table.fecha, table.estado, table.delegacion, table.tipoEntidad).toQuery()
  return connector.execQuery(query, client)
         .then(r => {
           let solicitud_added = r.rows[0];
           return solicitud_added;
         })
}

module.exports.add = function(solicitud) {
  return new Promise(function(resolve, reject) {
    connector
    .beginTransaction()
    .then(connection => {

        if (solicitud.tipoEntidad == 'profesional') {
          Profesional.addProfesional(connection.client, solicitud.entidad)
            .then(profesional_added => {
              solicitud.entidad = profesional_added;
              return addSolicitud(connection.client, solicitud)
                .then(solicitud_added => {
                  return connector
                  .commit(connection.client)
                  .then(r => {
                    connection.done();
                    solicitud_added.profesional = profesional_added;
                    resolve(solicitud_added);
                  });
                })
            })
            .catch(e => {
              connector.rollback(connection.client);
              connection.done();
              reject(e);
            });
        }
        else if (solicitud.tipoEntidad == 'empresa') {
          Empresa.addEmpresa(connection.client, solicitud.entidad)
            .then(empresa_added => {
              solicitud.entidad = empresa_added;
              return addSolicitud(connection.client, solicitud)
                .then(solicitud_added => {
                  return connector
                  .commit(connection.client)
                  .then(r => {
                    connection.done();
                    solicitud_added.empresa = empresa_added;
                    resolve(solicitud_added);
                  });
                })
            })
            .catch(e => {
              connector.rollback(connection.client);
              connection.done();
              reject(e);
            });
        }
      })
    });
}

module.exports.getAll = function() {
  return new Promise(function(resolve, reject) {
    let solicitudes = [];
    let query = table.select(table.star()).from(table).toQuery();
    connector.execQuery(query)
    .then(r => {
      solicitudes = r.rows;
      let proms = solicitudes.map(s => {
        if (s.tipoEntidad == 'profesional') return Profesional.get(s.entidad)
        else if (s.tipoEntidad == 'empresa') return Empresa.get(s.entidad);
      });

      Promise.all(proms)
             .then(rs => {
               rs.forEach((r, i) => {
                 solicitudes[i].entidad = r;
               });
               resolve(solicitudes);
             })
    })
    .catch(e => reject(e));
  });
}

module.exports.get = function(id) {
  return new Promise(function(resolve, reject) {
    let solicitud = {};
    let query = table.select(table.star())
                     .from(table)
                     .where(table.id.equals(id))
                     .toQuery();
    connector.execQuery(query)
    .then(r => {
      solicitud = r.rows[0];
      if (s.tipoEntidad == 'profesional') return Profesional.get(solicitud.entidad)
      else if (s.tipoEntidad == 'empresa') return Empresa.get(solicitud.entidad);
    })
    .then(r => {
      solicitud.entidad = r;
      resolve(solicitud);
    })
    .catch(e => reject(e));
  });
}