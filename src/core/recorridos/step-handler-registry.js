/**
 * Registry de metadata de handlers especiales para steps
 * 
 * Este registry proporciona información visual y descriptiva
 * sobre los handlers que pueden ser asignados a steps en recorridos.
 * 
 * USO: Solo para UI/UX del editor, no afecta runtime
 */

export const HANDLER_INFO = {
  selection_handler_v1: {
    label: 'Selección de ítems',
    icon: '☑️',
    description: 'Carga ítems desde catálogos PDE según nivel y modo'
  },
  practice_timer_handler_v1: {
    label: 'Práctica con temporizador',
    icon: '⏱️',
    description: 'Calcula duración total y gestiona reloj de práctica'
  },
  limpieza_energetica_handler: {
    label: 'Limpieza energética',
    icon: '⚡',
    description: 'Ejecuta transmutaciones y registra racha diaria'
  }
};


