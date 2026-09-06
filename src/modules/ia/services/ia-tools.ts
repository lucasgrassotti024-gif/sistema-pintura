/**
 * Fachada de compatibilidade retroativa para as Tools da IA Operacional.
 * As ferramentas foram modularizadas em src/modules/ia/tools/.
 */

export {
  ALL_AI_TOOL_DECLARATIONS,
  ALL_AI_TOOL_DECLARATIONS as IA_FUNCTION_DECLARATIONS,
  dispatchAiTool,
  dispatchAiTool as executeIaTool,
} from "../tools";
