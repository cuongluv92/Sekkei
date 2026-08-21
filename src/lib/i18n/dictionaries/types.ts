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
    designManagement: string;
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
    fromCatalog: string;
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
    statusUpdate: string;
    statusDuplicate: string;
    statusSkip: string;
    statusError: string;
    dedupeNotice: string;
    updateActionLabel: string;
    applyUpdateOption: string;
    skipOption: string;
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
    partTemplateSection: string;
    partTemplateDescription: string;
    kindExcel: string;
    kindDwg: string;
  };
  design: {
    title: string;
    topTabs: {
      designRequest: string;
      productionRequest: string;
      drawingRegister: string;
      designIndexKeio: string;
      designIndexOther: string;
      schedule: string;
      costLabor: string;
    };
    workspaceBar: {
      projectLabel: string;
      projectPlaceholder: string;
      addProject: string;
      projectNamePlaceholder: string;
      caseLabel: string;
      casePlaceholder: string;
      newCase: string;
      searchButton: string;
      noProjects: string;
      noCases: string;
      selectProjectFirst: string;
      selectCasePrompt: string;
    };
    newCaseForm: {
      title: string;
      drawingNumberPreview: string;
      submitButton: string;
    };
    fields: {
      year: string;
      requestType: string;
      drawingNumber: string;
      managementNumber: string;
      constructionNumber: string;
      orderer: string;
      customerContact: string;
      projectName: string;
      designRemarks: string;
      assignee: string;
      caseStatus: string;
      caseStatusOptions: {
        none: string;
        designPendingApproval: string;
        productionRequested: string;
      };
      manufacturingComplete: string;
    };
    panels: {
      title: string;
      addPanel: string;
      removePanel: string;
      panelNo: string;
      panelName: string;
      panelStructure: string;
      faceCount: string;
      designDueDate: string;
      designEstimatedHours: string;
      designActualHours: string;
      empty: string;
    };
    specs: {
      exteriorTitle: string;
      wiringTitle: string;
      groupBox: string;
      groupPaint: string;
      groupHandle: string;
      groupOther: string;
      spec1: string;
      spec2: string;
      spec3: string;
      fields: {
        location: string;
        installation: string;
        structure: string;
        material: string;
        color: string;
        gloss: string;
        handleLocation: string;
        handleType: string;
        keyNo: string;
        wireEntry: string;
        opening: string;
        blankPlate: string;
        electricalMethod: string;
        powerSource: string;
        voltage: string;
        terminalBlock: string;
      };
    };
    comingSoon: string;
    productionComingSoon: string;
    saveButton: string;
    savedMessage: string;
    search: {
      title: string;
      description: string;
      button: string;
      clearButton: string;
      resultTitle: string;
      noResults: string;
      andHint: string;
      panelNameLabel: string;
      allProjects: string;
    };
    ledger: {
      empty: string;
      yearFilterLabel: string;
      allYears: string;
      searchPlaceholder: string;
      noResults: string;
      columns: {
        year: string;
        drawingNumber: string;
        managementNumber: string;
        constructionNumber: string;
        orderer: string;
        customerContact: string;
        projectName: string;
        panelNames: string;
        manufacturingComplete: string;
        updatedAt: string;
      };
    };
    index: {
      empty: string;
      yearBlockTitle: string;
      searchPlaceholder: string;
      columns: {
        drawingNumber: string;
        managementNumber: string;
        projectName: string;
        panelNames: string;
        assignee: string;
        remarks: string;
      };
    };
    production: {
      sharedInfoTitle: string;
      sharedInfoHint: string;
      panelsTitle: string;
      caseFieldsTitle: string;
      panelColumns: {
        electricalMethod: string;
        ratedVoltage: string;
        ratedCurrent: string;
        ratedBreakingCapacity: string;
        frequency: string;
        controlVoltage: string;
        protectionRating: string;
      };
      fields: {
        productionNotes: string;
        inspectionSheet: string;
        filmThickness: string;
        earthLeakage: string;
        earthLeakageAlarm: string;
        withstandVoltage: string;
      };
    };
    schedule: {
      goToCurrentMonth: string;
      yearLabel: string;
      monthLabel: string;
      milestonesTitle: string;
      timelineTitle: string;
      legendTitle: string;
      milestones: {
        sheetMetalOrder: string;
        sheetMetalDelivery: string;
        boxOrder: string;
        boxDelivery: string;
        accessoryOrder: string;
        accessoryDelivery: string;
        productionStart: string;
        productionEnd: string;
        inspectionStart: string;
        inspectionEnd: string;
        witnessStart: string;
        witnessEnd: string;
        shippingStart: string;
        shippingEnd: string;
        delivery: string;
      };
      categories: {
        sheetMetal: string;
        box: string;
        accessory: string;
        production: string;
        inspection: string;
        witness: string;
        shipping: string;
      };
    };
    costLabor: {
      totalsTitle: string;
      designEstimatedTotal: string;
      designActualTotal: string;
      productionEstimatedTotal: string;
      productionActualTotal: string;
      yearBlockTitle: string;
      filterProject: string;
      searchPlaceholder: string;
      columns: {
        drawingNumber: string;
        projectName: string;
        panelNames: string;
        panelCount: string;
        designEstimated: string;
        designActual: string;
        productionEstimated: string;
        productionActual: string;
      };
    };
  };
  designSettings: {
    title: string;
    description: string;
    selectListLabel: string;
    addValuePlaceholder: string;
    addButton: string;
    emptyList: string;
    enableButton: string;
    disableButton: string;
    lists: {
      requestType: string;
      orderer: string;
      customerContact: string;
      panelStructure: string;
      faceCount: string;
      location: string;
      installation: string;
      structure: string;
      material: string;
      color: string;
      gloss: string;
      handleLocation: string;
      handleType: string;
      keyNo: string;
      wireEntry: string;
      opening: string;
      blankPlate: string;
      electricalMethod: string;
      powerSource: string;
      voltage: string;
      terminalBlock: string;
      current: string;
      breakingCapacity: string;
      frequency: string;
      controlVoltage: string;
      protectionRating: string;
    };
  };
  partSettings: {
    title: string;
    description: string;
    selectListLabel: string;
    addValuePlaceholder: string;
    addButton: string;
    emptyList: string;
    enableButton: string;
    disableButton: string;
    lists: {
      category: string;
      symbol: string;
    };
    manufacturers: {
      title: string;
      description: string;
      addPlaceholder: string;
      addButton: string;
      empty: string;
    };
  };
  selectionSettings: {
    title: string;
    description: string;
    addButton: string;
    emptyList: string;
    enableButton: string;
    disableButton: string;
    columns: {
      outputKey: string;
      unit: string;
      minValue: string;
      maxValue: string;
      resultValue: string;
      remarks: string;
    };
  };
  backupSettings: {
    title: string;
    exportDescription: string;
    createButton: string;
    restoreDescription: string;
    uploadHint: string;
    previewTitle: string;
    confirmRestoreButton: string;
    restoreDone: string;
    reloadButton: string;
    invalidFile: string;
  };
  scheduleColorSettings: {
    title: string;
    description: string;
    resetButton: string;
    categories: {
      sheetMetal: string;
      box: string;
      accessory: string;
      production: string;
      inspection: string;
      witness: string;
      shipping: string;
    };
  };
}
