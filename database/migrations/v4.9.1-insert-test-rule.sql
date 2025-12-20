-- Migración v4.9.1: Regla de prueba para AUTO-1
-- Fecha: 2025-01-XX
-- Descripción: Inserta una regla de prueba simple para verificar funcionamiento end-to-end
--               Trigger: pause_end
--               Actions: audit + portal_message

-- Regla de prueba: welcome_on_pause_end
-- Se ejecuta cuando se finaliza una pausa
INSERT INTO automation_rules (
    key,
    version,
    status,
    trigger_type,
    trigger_def,
    guards,
    actions,
    priority,
    cooldown_days
) VALUES (
    'welcome_on_pause_end',
    1,
    'on', -- Activa por defecto (cambiar a 'beta' o 'off' si se desea)
    'event',
    '{"event": "pause_end"}'::jsonb,
    '[]'::jsonb, -- Sin guards adicionales
    '[
        {
            "step_key": "audit",
            "payload": {
                "action": "automation_welcome_pause_end",
                "actor": "system",
                "actor_id": "automation_engine",
                "entity_type": "automation_run",
                "payload": {
                    "message": "Bienvenida automática después de pausa"
                }
            }
        },
        {
            "step_key": "portal_message",
            "payload": {
                "message": "¡Bienvenido de vuelta! Tu pausa ha finalizado."
            }
        }
    ]'::jsonb,
    0, -- Prioridad normal
    NULL -- Sin cooldown
) ON CONFLICT (key) DO NOTHING;

-- Comentario para documentación
COMMENT ON TABLE automation_rules IS 'Reglas de automatización declarativas (AUTO-1). Regla de prueba: welcome_on_pause_end';













