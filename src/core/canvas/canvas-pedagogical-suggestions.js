// src/core/canvas/canvas-pedagogical-suggestions.js
// Sugerencias Pedagógicas del Canvas (READ-ONLY)
// AXE v0.6.10 - Sugerencias Pedagógicas
//
// PRINCIPIOS:
// - Función pura generateSuggestions(canvas, diagnostics)
// - No modifica canvas
// - No persiste
// - No afecta publish ni runtime
// - No reanaliza (usa diagnostics como input)
// - Todo fail-open

import { analyzeCanvas } from './canvas-semantic-analysis.js';

/**
 * Genera sugerencias pedagógicas basadas en CanvasDefinition y diagnósticos
 * 
 * Tipos de sugerencias:
 * - Pedagógicas: intención, decisiones, finales
 * - Ritmo: secuencias largas, desequilibrios
 * - Claridad: meta ausente o ambigua
 * 
 * @param {Object} canvas - CanvasDefinition a analizar
 * @param {Object} diagnostics - Diagnósticos existentes (opcional, se generan si no se proporcionan)
 * @param {Object} diagnostics.warnings - Array de warnings
 * @param {Object} diagnostics.infos - Array de infos
 * @returns {Array<Suggestion>} Array de sugerencias pedagógicas
 * 
 * @typedef {Object} Suggestion
 * @property {string} type - 'pedagogical' | 'rhythm' | 'clarity'
 * @property {string} category - 'intention' | 'decision' | 'ending' | 'sequence' | 'balance' | 'meta'
 * @property {string} message - Mensaje humano y explicativo
 * @property {string|null} node_id - ID del nodo relacionado (si aplica, para selección)
 * @property {string|null} edge_id - ID del edge relacionado (si aplica)
 * @property {string} priority - 'high' | 'medium' | 'low'
 */
export function generateSuggestions(canvas, diagnostics = null) {
  const suggestions = [];

  // Fail-open: si canvas es inválido, devolver array vacío
  if (!canvas || typeof canvas !== 'object') {
    return suggestions;
  }

  // Si no se proporcionan diagnósticos, generarlos
  if (!diagnostics) {
    diagnostics = analyzeCanvas(canvas);
  }

  const nodes = canvas.nodes || [];
  const edges = canvas.edges || [];
  const warnings = diagnostics.warnings || [];
  const infos = diagnostics.infos || [];

  // 1. SUGERENCIAS PEDAGÓGICAS

  // 1.1. Intención (meta.intention ausente o ambigua)
  const nodesWithoutIntention = nodes.filter(n => {
    if (n.type === 'start' || n.type === 'end' || n.type === 'group' || n.type === 'comment') {
      return false;
    }
    const meta = n.meta || {};
    return !meta.intention || typeof meta.intention !== 'string' || meta.intention.trim().length === 0;
  });

  if (nodesWithoutIntention.length > 0) {
    if (nodesWithoutIntention.length === nodes.filter(n => 
      n.type !== 'start' && n.type !== 'end' && n.type !== 'group' && n.type !== 'comment'
    ).length) {
      // Todos los nodos sin intención
      suggestions.push({
        type: 'pedagogical',
        category: 'intention',
        message: 'Ningún nodo tiene una intención pedagógica definida (meta.intention). Considera agregar metadatos que expliquen el propósito educativo de cada paso.',
        node_id: null,
        edge_id: null,
        priority: 'high'
      });
    } else {
      // Algunos nodos sin intención
      const firstNodeWithoutIntention = nodesWithoutIntention[0];
      suggestions.push({
        type: 'pedagogical',
        category: 'intention',
        message: `${nodesWithoutIntention.length} nodo(s) no tienen intención pedagógica definida. Agregar meta.intention ayuda a clarificar el propósito educativo de cada paso.`,
        node_id: firstNodeWithoutIntention.id,
        edge_id: null,
        priority: 'medium'
      });
    }
  }

  // 1.2. Decisiones sin contexto pedagógico
  const decisionNodes = nodes.filter(n => n.type === 'decision');
  const decisionsWithoutContext = decisionNodes.filter(decision => {
    const meta = decision.meta || {};
    return !meta.intention || !meta.decision_context || typeof meta.decision_context !== 'string';
  });

  if (decisionsWithoutContext.length > 0) {
    const firstDecision = decisionsWithoutContext[0];
    suggestions.push({
      type: 'pedagogical',
      category: 'decision',
      message: `${decisionsWithoutContext.length} decisión(es) no tienen contexto pedagógico claro. Considera agregar meta.decision_context para explicar por qué el estudiante debe tomar esta decisión y qué aprendizaje se busca.`,
      node_id: firstDecision.id,
      edge_id: null,
      priority: 'high'
    });
  }

  // 1.3. Finales sin significado pedagógico
  const endNodes = nodes.filter(n => n.type === 'end');
  const endsWithoutMeaning = endNodes.filter(end => {
    const meta = end.meta || {};
    return !meta.ending_type || !meta.ending_message;
  });

  if (endsWithoutMeaning.length > 0) {
    const firstEnd = endsWithoutMeaning[0];
    suggestions.push({
      type: 'pedagogical',
      category: 'ending',
      message: `${endsWithoutMeaning.length} nodo(s) final(es) no tienen significado pedagógico definido. Considera agregar meta.ending_type (ej: "success", "reflection", "challenge") y meta.ending_message para dar contexto al final del recorrido.`,
      node_id: firstEnd.id,
      edge_id: null,
      priority: 'medium'
    });
  }

  // 1.4. Decisiones con opciones sin descripción
  for (const decision of decisionNodes) {
    const props = decision.props || {};
    const choices = props.choices || [];
    const choicesWithoutDescription = choices.filter(c => !c.description || c.description.trim().length === 0);
    
    if (choicesWithoutDescription.length > 0 && choices.length > 0) {
      suggestions.push({
        type: 'pedagogical',
        category: 'decision',
        message: `La decisión '${decision.id}' tiene ${choicesWithoutDescription.length} opción(es) sin descripción. Agregar descripciones claras ayuda al estudiante a entender las consecuencias de cada elección.`,
        node_id: decision.id,
        edge_id: null,
        priority: 'medium'
      });
      break; // Solo sugerir una vez por decisión
    }
  }

  // 2. SUGERENCIAS DE RITMO

  // 2.1. Secuencias largas (basado en diagnósticos)
  const longSequenceWarnings = warnings.filter(w => 
    w.type === 'pedagogical' && 
    w.message && 
    w.message.includes('Secuencia lineal larga')
  );

  if (longSequenceWarnings.length > 0) {
    const firstWarning = longSequenceWarnings[0];
    suggestions.push({
      type: 'rhythm',
      category: 'sequence',
      message: 'Hay secuencias lineales muy largas sin decisiones intermedias. Considera agregar puntos de decisión o reflexión para mantener el ritmo pedagógico y evitar que el estudiante se sienta abrumado.',
      node_id: firstWarning.node_id,
      edge_id: null,
      priority: 'medium'
    });
  }

  // 2.2. Desequilibrios en ramas (basado en diagnósticos)
  const unbalancedWarnings = warnings.filter(w => 
    w.type === 'rhythm' && 
    w.message && 
    w.message.includes('ramas desbalanceadas')
  );

  if (unbalancedWarnings.length > 0) {
    const firstWarning = unbalancedWarnings[0];
    suggestions.push({
      type: 'rhythm',
      category: 'balance',
      message: 'Hay decisiones con ramas muy desbalanceadas en longitud. Considera equilibrar las ramas para que todas las opciones tengan un peso pedagógico similar y el estudiante no sienta que una opción es "más importante" que otra.',
      node_id: firstWarning.node_id,
      edge_id: null,
      priority: 'low'
    });
  }

  // 2.3. Densidad de decisiones (basado en diagnósticos)
  const highDensityWarnings = warnings.filter(w => 
    w.type === 'rhythm' && 
    w.message && 
    w.message.includes('Alta densidad de decisiones')
  );

  if (highDensityWarnings.length > 0) {
    suggestions.push({
      type: 'rhythm',
      category: 'balance',
      message: 'El canvas tiene una densidad muy alta de decisiones. Demasiadas decisiones seguidas pueden ser abrumadoras. Considera intercalar pantallas informativas o de reflexión entre decisiones.',
      node_id: null,
      edge_id: null,
      priority: 'medium'
    });
  }

  // 2.4. Canvas completamente lineal (basado en diagnósticos)
  const linearInfos = infos.filter(i => 
    i.type === 'rhythm' && 
    i.message && 
    i.message.includes('completamente lineal')
  );

  if (linearInfos.length > 0) {
    suggestions.push({
      type: 'rhythm',
      category: 'sequence',
      message: 'El canvas es completamente lineal sin decisiones. Considera agregar puntos de decisión o ramificaciones para hacer el recorrido más interactivo y adaptativo al estudiante.',
      node_id: null,
      edge_id: null,
      priority: 'low'
    });
  }

  // 3. SUGERENCIAS DE CLARIDAD

  // 3.1. Meta ausente o ambigua
  const nodesWithIncompleteMeta = nodes.filter(n => {
    if (n.type === 'start' || n.type === 'end' || n.type === 'group' || n.type === 'comment') {
      return false;
    }
    const meta = n.meta || {};
    // Verificar si tiene meta pero está vacío o solo tiene campos técnicos
    const hasMeta = n.meta !== undefined;
    const hasOnlyTechnicalMeta = hasMeta && Object.keys(meta).length > 0 && 
      Object.keys(meta).every(key => ['x', 'y', 'width', 'height'].includes(key));
    return hasMeta && (Object.keys(meta).length === 0 || hasOnlyTechnicalMeta);
  });

  if (nodesWithIncompleteMeta.length > 0) {
    const firstNode = nodesWithIncompleteMeta[0];
    suggestions.push({
      type: 'clarity',
      category: 'meta',
      message: `${nodesWithIncompleteMeta.length} nodo(s) tienen meta vacío o solo con información técnica. Considera agregar meta.intention, meta.description u otros campos pedagógicos para clarificar el propósito del nodo.`,
      node_id: firstNode.id,
      edge_id: null,
      priority: 'medium'
    });
  }

  // 3.2. Nodos con meta.intention muy corta o genérica
  const nodesWithGenericIntention = nodes.filter(n => {
    if (n.type === 'start' || n.type === 'end' || n.type === 'group' || n.type === 'comment') {
      return false;
    }
    const meta = n.meta || {};
    const intention = meta.intention || '';
    // Intenciones muy cortas (< 10 caracteres) o genéricas
    const isTooShort = intention.length > 0 && intention.length < 10;
    const isGeneric = ['paso', 'step', 'nodo', 'node', 'acción', 'action'].some(
      word => intention.toLowerCase().includes(word)
    );
    return isTooShort || isGeneric;
  });

  if (nodesWithGenericIntention.length > 0) {
    const firstNode = nodesWithGenericIntention[0];
    suggestions.push({
      type: 'clarity',
      category: 'meta',
      message: `${nodesWithGenericIntention.length} nodo(s) tienen intenciones muy genéricas o cortas. Considera hacer las intenciones más específicas y descriptivas para clarificar el propósito pedagógico.`,
      node_id: firstNode.id,
      edge_id: null,
      priority: 'low'
    });
  }

  // 3.3. Decisiones sin explicación de las opciones
  for (const decision of decisionNodes) {
    const meta = decision.meta || {};
    const props = decision.props || {};
    const choices = props.choices || [];
    
    // Verificar si hay opciones pero no hay explicación de por qué estas opciones
    if (choices.length >= 2 && !meta.decision_rationale) {
      suggestions.push({
        type: 'clarity',
        category: 'meta',
        message: `La decisión '${decision.id}' tiene opciones pero no explica por qué estas opciones específicas. Considera agregar meta.decision_rationale para clarificar el propósito pedagógico de la decisión.`,
        node_id: decision.id,
        edge_id: null,
        priority: 'low'
      });
      break; // Solo sugerir una vez
    }
  }

  return suggestions;
}











