class TreeItem {
  constructor() {
    this.command = undefined;
  }
}

class EventEmitter {
  constructor() {
    this.event = () => {};
  }
  fire() {}
}

class Range {
  constructor() {}
}

class WorkspaceEdit {
  replace() {}
}

module.exports = {
  TreeItem,
  EventEmitter,
  Range,
  WorkspaceEdit,
  ViewColumn: { One: 1 },
  TreeItemCollapsibleState: { Expanded: 1 },
  window: {},
  workspace: {},
  commands: {}
};
