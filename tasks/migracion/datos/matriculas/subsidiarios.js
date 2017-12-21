const connector = require('../../../../connector');
const sql = require('sql');
sql.setDialect('postgres');
const model = require('../../../../model');
const utils = require('../../utils');

const addSubsidiario = (subsidiario) => {
  return model.Matricula.getMigracion(subsidiario['ID'])
  .then(matricula => {
    let nuevoSubsidiario = {};
    nuevoSubsidiario.profesional = matricula.entidad;
    nuevoSubsidiario.nombre = subsidiario['NOMBRE'].trim();
    nuevoSubsidiario.apellido = subsidiario['APELLIDO'].trim();
    nuevoSubsidiario.dni = subsidiario['NUMDOCU'].trim();
    nuevoSubsidiario.porcentaje = subsidiario['PORCENTAJE'];
    return model.Subsidiario.addSubsidiario(nuevoSubsidiario);
  });
}


module.exports.migrar = function() {
    console.log('Migrando subsidiarios de caja...');
    let q_objetos = `select s.ID, s.APELLIDO,
            s.NOMBRE, s.PORCENTAJE, s.NUMDOCU
            from MAT_SUBSIDIO s inner join MATRICULAS m
            on s.ID=m.ID
            where s.ID between @offset and @limit`;
    let q_limites = 'select MIN(ID) as min, MAX(ID) as max from MAT_SUBSIDIO';

    return utils.migrar(q_objetos, q_limites, 100, addSubsidiario);
}
