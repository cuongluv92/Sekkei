/**
 * Shape of a locale dictionary. Both `ja` and `vi` are typed against this
 * interface so the two stay in sync at compile time.
 */
export interface Dictionary {
  app: {
    name: string;
    tagline: string;
  };
  nav: {
    search: string;
    selection: string;
    partAssembly: string;
    partData: string;
    partDrawing: string;
    catalog: string;
    weightCalc: string;
    ventilationCalc: string;
    seismicCalc: string;
    otherCalc: string;
    import: string;
    settings: string;
  };
  common: {
    search: string;
    globalSearchPlaceholder: string;
    clear: string;
    calculate: string;
    excelExport: string;
    pdfExport: string;
    dwgExport: string;
    display: string;
    dwg: string;
    pdf: string;
    download: string;
    add: string;
    delete: string;
    edit: string;
    quantity: string;
    remarks: string;
    source: string;
    kind: string;
    manufacturer: string;
    model: string;
    specification: string;
    symbol: string;
    name: string;
    category: string;
    fileName: string;
    updatedAt: string;
    loading: string;
    empty: string;
    noResults: string;
    error: string;
    confirm: string;
    cancel: string;
    save: string;
    upload: string;
    selectFile: string;
    analyze: string;
    import: string;
    close: string;
    back: string;
    next: string;
    actions: string;
    selectPrompt: string;
    preview: string;
    detail: string;
    filter: string;
    all: string;
    status: string;
    result: string;
    input: string;
    notImplemented: string;
    mockBadge: string;
  };
  search: {
    title: string;
    description: string;
    placeholder: string;
    button: string;
    resultsFor: string;
    resultCount: string;
    fromPartData: string;
    fromPartDrawing: string;
    previewTitle: string;
    previewEmpty: string;
    previewLoading: string;
    previewError: string;
    dwgNotice: string;
  };
  selection: {
    title: string;
    description: string;
    inputLabel: string;
    inputPlaceholder: string;
    inputHint: string;
    outputLabel: string;
    outputs: {
      breaker: string;
      am: string;
      magneticContactor: string;
      wireSize: string;
      terminalBlock: string;
      other: string;
    };
    resultTitle: string;
    resultEmpty: string;
    ruleNotice: string;
  };
  partAssembly: {
    title: string;
    description: string;
    searchPlaceholder: string;
    tableTitle: string;
    tableEmpty: string;
    addRow: string;
    reorderHint: string;
  };
  partData: {
    title: string;
    description: string;
    tableEmpty: string;
  };
  partDrawing: {
    title: string;
    description: string;
    tableEmpty: string;
  };
  catalog: {
    title: string;
    description: string;
    tableEmpty: string;
  };
  calculation: {
    resultTitle: string;
    resultEmpty: string;
    inputTitle: string;
    outputTitle: string;
    formulaPending: string;
    templateNotice: string;
  };
  weightCalc: {
    title: string;
    description: string;
  };
  ventilationCalc: {
    title: string;
    description: string;
  };
  seismicCalc: {
    title: string;
    description: string;
  };
  otherCalc: {
    title: string;
    description: string;
    modules: {
      busbar: string;
      earthWire: string;
    };
    addModuleHint: string;
  };
  importPage: {
    title: string;
    description: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    dropHint: string;
    targetLabel: string;
    targets: {
      partData: string;
      partDrawing: string;
      catalog: string;
    };
    analyzeButton: string;
    analyzing: string;
    statusNew: string;
    statusExisting: string;
    statusSkip: string;
    statusError: string;
    dedupeNotice: string;
    confirmButton: string;
    importDone: string;
  };
  settings: {
    title: string;
    languageSection: string;
    languageDescription: string;
    calcSection: string;
    calcDescription: string;
    templateSection: string;
    templateDescription: string;
    templateUpload: string;
    templateEmpty: string;
    formulaEmpty: string;
    configureButton: string;
  };
}
