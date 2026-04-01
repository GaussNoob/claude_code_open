export const API_RESIZE_PARAMS = Object.freeze({
  maxLongSide: 1568,
  minShortSide: 768,
})

export function targetImageSize(w, h, _params) {
  return [w, h]
}

export function buildComputerUseTools(_capabilities, _coordinateMode, _installedAppNames) {
  return []
}

export function createComputerUseMcpServer(_adapter, _coordinateMode) {
  return {
    async connect(_transport) {},
    setRequestHandler(_schema, _handler) {},
  }
}

export function bindSessionContext(_adapter, _coordinateMode, _ctx) {
  return async () => ({
    content: [{ type: 'text', text: 'Computer Use MCP is not available in this build.' }],
    isError: true,
  })
}

export const DEFAULT_GRANT_FLAGS = Object.freeze({
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
})
