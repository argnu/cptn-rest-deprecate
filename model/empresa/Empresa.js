const moment = require('moment');
const sql = require('sql');
sql.setDialect('postgres');

const connector = require(`${__base}/connector`);
const Domicilio = require(`${__base}/model/Domicilio`);
const Entidad = require(`${__base}/model/Entidad`);
const Contacto = require(`${__base}/model/Contacto`);
const TipoEmpresa = require(`${__base}/model/tipos/TipoEmpresa`);
const TipoSociedad = require(`${__base}/model/tipos/TipoSociedad`);
const TipoCondicionAfip = require(`${__base}/model/tipos/TipoCondicionAfip`);
const EmpresaRepresentante = require('./EmpresaRepresentante');
const EmpresaIncumbencia = require('./EmpresaIncumbencia');


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
      table: 't_empresa',
      columns: [ 'tipoEmpresa' ],
      refColumns: [ 'id' ]
    },
    {
      table: 't_sociedad',
      columns: [ 'tipoSociedad' ],
      refColumns: [ 'id' ]
    }
  ]
});

module.exports.table = table;

module.exports.add = function(empresa, client) {
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

  return Entidad.add({
    tipo: empresa.tipo,
    cuit: empresa.cuit,
    condafip: empresa.condafip,
    domicilios: empresa.domicilios
  }, client)
  .then(entidad => {
    empresa.id = entidad.id;
    return addDatosBasicos(empresa)
          .then(r => {
            let empresa_added = r.rows[0];

            let proms_contactos = empresa.contactos.map(c => {
              c.entidad = empresa_added.id;
              return Contacto.add(c, client);
            });

            let proms_representantes = empresa.representantes ?
              empresa.representantes.map(r => EmpresaRepresentante.add({
                empresa: empresa_added.id,
                matricula: r,
                fechaInicio: r.fechaInicio ? r.fechaInicio : moment(),
                fechaFin: r.fechaFin ? r.fechaFin : null
              }, client))
              : [];

              let proms_incumbencias = empresa.incumbencias ? 
                empresa.incumbencias.map(i => EmpresaIncumbencia.add({
                  empresa: empresa_added.id,
                  incumbencia: i
                }, client))
              : [];

              console.log('llega')

            return Promise.all([
              Promise.all(proms_contactos),
              Promise.all(proms_representantes),
              Promise.all(proms_incumbencias)
            ])
            .then(([contactos, representantes, incumbencias]) => {
              empresa_added.contactos = contactos;
              empresa_added.representantes = representantes;
              empresa_added.incumbencias = incumbencias;
              return empresa_added;
            });
          });
  })
}


const select_atributes = [table.id,
Entidad.table.tipo,
table.nombre, table.fechaInicio,
table.fechaConstitucion,
TipoEmpresa.table.valor.as('tipoEmpresa'),
TipoSociedad.table.valor.as('tipoSociedad'),
TipoCondicionAfip.table.valor.as('condafip'),
Entidad.table.cuit,
];

const select_from = table.join(Entidad.table).on(table.id.equals(Entidad.table.id))
                         .leftJoin(TipoEmpresa.table).on(table.tipoEmpresa.equals(TipoEmpresa.table.id))
                         .leftJoin(TipoSociedad.table).on(table.tipoSociedad.equals(TipoSociedad.table.id))
                         .leftJoin(TipoCondicionAfip.table).on(Entidad.table.condafip.equals(TipoCondicionAfip.table.id))

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
      [ domicilios, contactos, incumbencias, representantes ] = value;
      empresas[index].domicilios = domicilios;
      empresas[index].contactos = contactos;
      empresas[index].incumbencias = incumbencias;
      empresas[index].representantes = representantes;
    });
    return empresas;
  })
}


function getDatosEmpresa(empresa) {
  return Promise.all([
      EntidadDomicilio.getByEntidad(empresa.id),
      Contacto.getAll(empresa.id),
      EmpresaIncumbencia.getAll(empresa.id),
      EmpresaRepresentante.getAll(empresa.id)
    ]);
}

module.exports.get = function(id) {
  let empresa;
  let query = table.select(...select_atributes)
                  .from(select_from)
                  .where(table.id.equals(id))
                  .toQuery();

  return connector.execQuery(query)
  .then(r => {
    empresa = r.rows[0];
    return getDatosEmpresa(empresa);
  })
  .then(([ domicilios, contactos, incumbencias, representantes ]) => {
      empresa.domicilios = domicilios;
      empresa.domicilioProfesional = domicilioProfesional;
      empresa.domicilioConstituido = domicilioConstituido;
      empresa.contactos = contactos;
      empresa.incumbencias = incumbencias;
      empresa.representantes = representantes;
      return empresa;
  });
}


module.exports.edit = function (id, empresa, client) {
  return Entidad.edit(id, {
    cuit: empresa.cuit,
    condafip: empresa.condafip,
    domicilios: empresa.domicilios,
  }, client)
    .then(r => {
      let query = table.update({
        nombre: empresa.nombre,
        fechaInicio: empresa.fechaInicio,
        fechaConstitucion: empresa.fechaConstitucion,
        tipoEmpresa: empresa.tipoEmpresa,
        tipoSociedad: empresa.tipoSociedad
      })
      .where(table.id.equals(id))
      .toQuery();

      return Promise.all([
        Contacto.getAll(empresa.id),
        EmpresaRepresentante.getAll(empresa.id),
        EmpresaIncumbencia.getAll(empresa.id)
      ])
        .then(([contactos, representantes, incumbencias]) => {
          return connector.execQuery(query, client)
            .then(r => {
              let proms_contactos = [];
              for (let c of empresa.contactos) {
                if (!c.id) {
                  c.entidad = id;
                  proms_contactos.push(Contacto.add(c, client));
                }
              }

              //BUSCO LOS CONTACTOS QUE YA NO ESTAN EN LA LISTA PARA BORRARLOS
              for (let contacto of contactos) {
                if (!empresa.contactos.find(c => c.id && c.id == contacto.id))
                  proms_contactos.push(Contacto.delete(contacto.id, client));
              }

              // let proms_representantes = [];
              // for (let representante of empresa.representantes) {
              //   if (!representantes.find(r => r.matricula == representante)) {
              //     proms_representantes.push(EmpresaRepresentante.add({ 
              //       empresa: id, 
              //       matricula: representante,
              //       fechaInicio: moment()
              //      }, client));
              //   }
              // }

              // for (let representante of representantes) {
              //   if (!empresa.representantes.find(r => r == representante.matricula))
              //     proms_representantes.push(
              //       EmpresaRepresentante.delete({
              //         empresa: id, 
              //         representante.matricula                      
              //       }, client)
              //     );
              // }


              let proms_incumbencias = [];
              for (let incumbencia of empresa.incumbencias) {
                if (!incumbencias.find(i => i.id == incumbencia)) {
                  proms_incumbencias.push(EmpresaIncumbencia.add({ 
                    empresa: id, 
                    incumbencia: incumbencia,
                   }, client));
                }
              }

              for (let incumbencia of incumbencias) {
                if (!empresa.incumbencias.find(i => i == incumbencia.id)) {
                  proms_incumbencias.push(
                    EmpresaIncumbencia.delete(id, incumbencia.id, client)
                  );
                }
              }

              return Promise.all([
                Promise.all(proms_contactos),
                Promise.all(proms_representantes),
                Promise.all(proms_incumbencias)
              ])
              .then(rs => id);
            })
        })
    })
}