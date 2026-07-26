(function () {
  "use strict";

  var DATA = window.PUMP_DEMO_DATA;
  var STORAGE_KEY = "pump-demo-state";
  var sceneOrder = DATA.scenes.map(function (scene) { return scene.key; });
  var nodeLabels = {
    warning: "异常事件",
    diagnosis: "诊断输出",
    review: "专家复核",
    work_order: "处置票卡",
    feedback: "复测反馈",
    report: "报告确认",
    case_entry: "知识审核",
    reuse: "复用验证",
  };

  var state = normalizeState(loadState() || defaultState());

  var stage = document.getElementById("stage");
  var sceneNav = document.getElementById("sceneNav");

  function saveState() {
    normalizeState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function defaultState() {
    return {
      scene: "event",
      selectedPoint: "P-DE-V",
      evidence: "",
      expertConfirmed: false,
      ticketGenerated: false,
      feedbackConfirmed: false,
      reportConfirmed: false,
      knowledgeApproved: false,
    };
  }

  function normalizeState(candidate) {
    var clean = defaultState();
    Object.keys(clean).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(candidate, key)) clean[key] = candidate[key];
    });
    if (sceneOrder.indexOf(clean.scene) < 0) clean.scene = "event";
    if (!DATA.measurementPoints.some(function (point) { return point.id === clean.selectedPoint; })) {
      clean.selectedPoint = "P-DE-V";
    }
    clean.expertConfirmed = clean.expertConfirmed === true;
    clean.ticketGenerated = clean.ticketGenerated === true && clean.expertConfirmed;
    clean.feedbackConfirmed = clean.feedbackConfirmed === true && clean.ticketGenerated;
    clean.reportConfirmed = clean.reportConfirmed === true && clean.feedbackConfirmed;
    clean.knowledgeApproved = clean.knowledgeApproved === true && clean.reportConfirmed;
    clean.evidence = typeof clean.evidence === "string" ? clean.evidence : "";
    Object.keys(clean).forEach(function (key) { candidate[key] = clean[key]; });
    return candidate;
  }

  function resetState() {
    window.localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    render();
  }

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "dataset") {
        Object.keys(value).forEach(function (name) { node.dataset[name] = value[name]; });
      } else if (value !== false && value != null) {
        node.setAttribute(key, value === true ? "" : value);
      }
    });
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return;
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
  }

  function asset(id) {
    return DATA.assets.find(function (item) { return item.id === id; });
  }

  function selectedPoint() {
    return DATA.measurementPoints.find(function (point) { return point.id === state.selectedPoint; }) || DATA.measurementPoints[0];
  }

  function sceneIndex(sceneKey) {
    return sceneOrder.indexOf(sceneKey);
  }

  function currentNode() {
    if (state.knowledgeApproved) return "reuse";
    if (state.reportConfirmed) return "case_entry";
    if (state.feedbackConfirmed) return "report";
    if (state.ticketGenerated) return "feedback";
    if (state.expertConfirmed) return "work_order";
    if (state.scene === "diagnosis") return "diagnosis";
    if (state.scene === "knowledge") return "review";
    return "warning";
  }

  function progressForScene(sceneKey) {
    var index = sceneIndex(sceneKey);
    if (index === 0) return "done";
    if (sceneKey === "diagnosis") return state.scene === "diagnosis" || state.expertConfirmed || state.ticketGenerated || state.feedbackConfirmed || state.reportConfirmed || state.knowledgeApproved ? "done" : "ready";
    if (sceneKey === "knowledge") return state.expertConfirmed || state.ticketGenerated || state.feedbackConfirmed || state.reportConfirmed || state.knowledgeApproved ? "done" : "ready";
    if (sceneKey === "workorder") return state.ticketGenerated || state.feedbackConfirmed || state.reportConfirmed || state.knowledgeApproved ? "done" : "ready";
    if (sceneKey === "report") return state.feedbackConfirmed || state.reportConfirmed || state.knowledgeApproved ? "done" : "ready";
    return index <= sceneIndex(state.scene) ? "ready" : "locked";
  }

  function canOpenScene(sceneKey) {
    if (sceneKey === "event" || sceneKey === "diagnosis" || sceneKey === "knowledge") return true;
    if (sceneKey === "workorder") return state.ticketGenerated;
    if (sceneKey === "report") return state.feedbackConfirmed;
    return false;
  }

  function setScene(sceneKey) {
    if (sceneOrder.indexOf(sceneKey) < 0 || !canOpenScene(sceneKey)) return;
    state.scene = sceneKey;
    saveState();
    render();
    stage.focus();
  }

  function render() {
    document.getElementById("subtitle").textContent = DATA.meta.subtitle + " · " + DATA.meta.batch;
    document.getElementById("clock").textContent = DATA.meta.clock;
    document.getElementById("nodeBadge").textContent = nodeLabels[currentNode()] || currentNode();
    renderNav();
    stage.innerHTML = "";
    stage.appendChild(renderScene());
    bindStageButtons();
  }

  function renderNav() {
    sceneNav.innerHTML = "";
    DATA.scenes.forEach(function (scene, index) {
      var status = progressForScene(scene.key);
      var locked = !canOpenScene(scene.key);
      var button = h("button", {
        class: "scene-button " + (state.scene === scene.key ? "active " : "") + status + (locked ? " locked" : ""),
        type: "button",
        disabled: locked,
        "aria-disabled": locked ? "true" : "false",
        dataset: { scene: scene.key },
      }, [
        h("span", { class: "scene-index", text: String(index + 1).padStart(2, "0") }),
        h("span", { class: "scene-label", text: scene.label }),
        h("span", { class: "scene-node", text: scene.node }),
      ]);
      button.addEventListener("click", function () { setScene(scene.key); });
      sceneNav.appendChild(button);
    });
  }

  function renderScene() {
    if (state.scene === "event") return renderEventScene();
    if (state.scene === "diagnosis") return renderDiagnosisScene();
    if (state.scene === "knowledge") return renderKnowledgeScene();
    if (state.scene === "workorder") return renderWorkorderScene();
    return renderReportScene();
  }

  function pageShell(title, kicker, action, content) {
    return h("section", { class: "scene-shell" }, [
      h("div", { class: "scene-head" }, [
        h("div", {}, [
          h("p", { class: "kicker", text: kicker }),
          h("h2", { text: title }),
        ]),
        action || statusStack(),
      ]),
      content,
      renderFlowStrip(),
    ]);
  }

  function statusStack() {
    return h("div", { class: "status-stack" }, [
      statusPill("专家复核", state.expertConfirmed),
      statusPill("复测反馈", state.feedbackConfirmed),
      statusPill("知识审核", state.knowledgeApproved),
    ]);
  }

  function statusPill(label, ok) {
    return h("span", { class: "status-pill " + (ok ? "ok" : "pending"), text: label + (ok ? " 已完成" : " 待完成") });
  }

  function renderEventScene() {
    var point = selectedPoint();
    return pageShell(
      "P-1 主事件入口",
      "默认展开当前关注级事件，不做平台总览",
      h("button", { class: "primary-action", type: "button", dataset: { action: "go-diagnosis" }, text: "进入诊断证据" }),
      h("div", { class: "event-grid" }, [
        h("section", { class: "main-event panel" }, [
          h("div", { class: "event-topline" }, [
            h("span", { class: "badge risk", text: DATA.event.grade }),
            h("span", { class: "mono", text: DATA.event.id }),
          ]),
          h("h3", { text: DATA.event.title }),
          h("p", { class: "event-trigger", text: DATA.event.trigger }),
          h("div", { class: "summary-grid" }, DATA.event.summary.map(function (item) {
            return h("div", { class: "summary-item" }, [
              h("span", { text: item.label }),
              h("strong", { text: item.value }),
            ]);
          })),
          h("div", { class: "source-row" }, [
            sourcePill("runtime", DATA.event.runtimeSource),
            sourcePill("basis", DATA.event.basisSource),
          ]),
        ]),
        h("section", { class: "asset-panel panel" }, [
          panelTitle("一泵一档", "CL-P1"),
          renderAssetFacts(asset("CL-P1")),
          h("div", { class: "asset-link" }, [
            h("strong", { text: "三级体系映射" }),
            h("p", { text: "诊断专家负责研判，区域监视中心推进处置，作业区完成现场反馈。" }),
          ]),
        ]),
        h("section", { class: "point-panel panel" }, [
          panelTitle("泵体测点示意", point.name),
          renderPointMap(),
        ]),
        h("section", { class: "timeline-panel panel" }, [
          panelTitle("事件时间线", "warning"),
          renderTimeline([
            ["15:42", "监测回放形成 P-1 关注事件"],
            ["15:46", "测点 P-DE-V 进入演示预警线"],
            ["15:51", "频谱和相位证据关联完成"],
            ["待处理", "提交专家复核"],
          ]),
        ]),
        h("section", { class: "capability-panel panel" }, [
          panelTitle("申报能力映射", "why this case"),
          h("div", { class: "capability-list" }, DATA.capabilityMap.map(function (item) {
            return h("article", { class: "capability-item" }, [
              h("strong", { text: item.capability }),
              h("p", { text: item.proof }),
              h("span", { text: item.demoPart + " / " + item.boundary }),
            ]);
          })),
        ]),
      ])
    );
  }

  function renderDiagnosisScene() {
    return pageShell(
      "专业诊断与证据链",
      "趋势、频谱、相位共同支撑疑似不对中",
      h("button", { class: "primary-action", type: "button", dataset: { action: "go-knowledge" }, text: "提交专家复核" }),
      h("div", { class: "diagnosis-grid" }, [
        h("section", { class: "trend-panel panel" }, [
          panelTitle("振动趋势与阈值", DATA.trend.title),
          renderTrendChart(),
          h("div", { class: "chart-legend" }, [
            legendItem("趋势值", "solid"),
            legendItem("80%预警线 5.68 mm/s", "warn"),
            legendItem("停机值 7.10 mm/s", "danger"),
          ]),
        ]),
        h("section", { class: "evidence-side" }, [
          renderSpectrumCard(),
          renderPhaseCard(),
          renderDiagnosisCard(),
        ]),
      ])
    );
  }

  function renderKnowledgeScene() {
    var action = state.expertConfirmed
      ? h("button", { class: "primary-action", type: "button", dataset: { action: "generate-ticket" }, text: "生成处置票卡" })
      : h("button", { class: "primary-action", type: "button", dataset: { action: "confirm-expert" }, text: "专家确认进入处置" });

    return pageShell(
      "专家复核与知识命中",
      "AI 给建议，专家确认，知识库给依据",
      action,
      h("div", { class: "knowledge-grid" }, [
        h("section", { class: "review-panel panel" }, [
          panelTitle("专家复核", state.expertConfirmed ? "confirmed" : "pending"),
          h("div", { class: "review-verdict " + (state.expertConfirmed ? "confirmed" : "") }, [
            h("strong", { text: state.expertConfirmed ? "已确认按疑似不对中进入处置" : "待诊断专家复核" }),
            h("p", { text: "模型输出只作为诊断建议，专家确认后才允许生成处置票卡。" }),
          ]),
          h("ul", { class: "plain-list" }, DATA.diagnosis.actions.map(function (actionText) {
            return h("li", { text: actionText });
          })),
        ]),
        h("section", { class: "knowledge-panel panel" }, [
          panelTitle("知识命中", "4 项依据"),
          h("div", { class: "knowledge-list" }, DATA.knowledgeItems.map(renderKnowledgeItem)),
        ]),
      ])
    );
  }

  function renderWorkorderScene() {
    var action;
    if (!state.ticketGenerated) {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "generate-ticket" }, disabled: !state.expertConfirmed, text: "生成处置票卡" });
    } else if (!state.feedbackConfirmed) {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "confirm-feedback" }, text: "确认复测反馈" });
    } else {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "go-report" }, text: "生成维修报告" });
    }

    return pageShell(
      "处置票卡与复测反馈",
      "标准作业步骤 + 现场反馈 + 前后对比",
      action,
      h("div", { class: "workorder-grid" }, [
        renderTicketPanel(),
        renderFeedbackPanel(),
      ])
    );
  }

  function renderReportScene() {
    var action;
    if (!state.reportConfirmed) {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "confirm-report" }, disabled: !state.feedbackConfirmed, text: "确认报告草稿" });
    } else if (!state.knowledgeApproved) {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "approve-knowledge" }, text: "知识审核通过" });
    } else {
      action = h("button", { class: "primary-action", type: "button", dataset: { action: "reset" }, text: "重置演示" });
    }

    return pageShell(
      "报告归档与案例复用",
      "报告确认 + 知识审核后，P-2 才能命中 P-1 案例",
      action,
      h("div", { class: "report-grid" }, [
        renderReportPanel(),
        h("section", { class: "case-panel panel" }, [
          panelTitle("知识审核与复用", state.knowledgeApproved ? "case reusable" : "pending audit"),
          renderCaseStatus(),
          renderReuseCard(),
        ]),
      ])
    );
  }

  function renderTicketPanel() {
    if (!state.ticketGenerated) {
      return h("section", { class: "ticket-panel panel" }, [
        panelTitle("演示态处置票卡", state.expertConfirmed ? "ready" : "locked"),
        renderLockedBlock(
          state.expertConfirmed ? "等待生成处置票卡" : "专家未确认，不能生成处置票卡",
          state.expertConfirmed ? "点击主按钮后，系统才会根据对中作业卡生成演示态票卡。" : "诊断建议必须经专家确认后，才能进入标准处置。"
        ),
      ]);
    }
    return h("section", { class: "ticket-panel panel" }, [
      panelTitle("演示态处置票卡", DATA.workOrder.id),
      renderStepList(DATA.workOrder.steps),
      h("div", { class: "ticket-meta" }, [
        miniBlock("角色", DATA.workOrder.roles.join(" / ")),
        miniBlock("许可", DATA.workOrder.permits.join(" / ")),
        miniBlock("工具", DATA.workOrder.tools.join(" / ")),
      ]),
    ]);
  }

  function renderFeedbackPanel() {
    if (!state.ticketGenerated) {
      return h("section", { class: "feedback-panel panel" }, [
        panelTitle("现场复测反馈", "locked"),
        renderLockedBlock("票卡未生成，不能录入复测反馈", "处置票卡生成并进入现场执行后，才允许展示复测数据。"),
      ]);
    }
    return h("section", { class: "feedback-panel panel" }, [
      panelTitle("现场复测反馈", state.feedbackConfirmed ? "accepted" : "waiting"),
      h("div", { class: "photo-pair" }, [
        imageFigure(DATA.assetImages.laserBefore, "调整前", "激光对中仪调整前读数"),
        imageFigure(DATA.assetImages.laserAfter, "调整后", "激光对中仪调整后读数"),
      ]),
      renderBeforeAfter(),
    ]);
  }

  function renderReportPanel() {
    if (!state.feedbackConfirmed) {
      return h("section", { class: "report-panel panel" }, [
        panelTitle("维修报告草稿", "locked"),
        renderLockedBlock("复测反馈未确认，不能生成完整报告", "报告必须从事件、诊断、票卡和现场反馈汇总，不能提前生成。"),
      ]);
    }
    return h("section", { class: "report-panel panel" }, [
      panelTitle("维修报告草稿", state.reportConfirmed ? "confirmed" : "draft"),
      h("h3", { text: DATA.report.title }),
      h("div", { class: "report-sections" }, DATA.report.sections.map(function (section) {
        return h("article", { class: "report-section" }, [
          h("strong", { text: section.title }),
          h("p", { text: section.text }),
        ]);
      })),
    ]);
  }

  function renderLockedBlock(title, text) {
    return h("div", { class: "locked-block" }, [
      h("strong", { text: title }),
      h("p", { text: text }),
    ]);
  }

  function renderAssetFacts(item) {
    var rows = [
      ["站场", item.station],
      ["设备", item.name],
      ["泵型号", item.pumpModel],
      ["电机型号", item.motorModel],
      ["转速", item.speedRpm + " rpm"],
      ["转频", item.rotatingFrequencyHz + " Hz"],
    ];
    return h("div", { class: "fact-grid" }, rows.map(function (row) {
      return h("div", { class: "fact" }, [
        h("span", { text: row[0] }),
        h("strong", { text: row[1] }),
      ]);
    }));
  }

  function renderPointMap() {
    return h("div", { class: "point-map" }, [
      h("img", { src: DATA.assetImages.pointMap, alt: "输油泵机组仪表点位图" }),
      h("div", { class: "point-overlays" }, DATA.measurementPoints.map(function (point) {
        return h("button", {
          class: "point-dot " + point.status + (state.selectedPoint === point.id ? " selected" : ""),
          type: "button",
          title: point.name,
          style: "left:" + point.x + "%;top:" + point.y + "%;",
          dataset: { point: point.id },
        }, [h("span", { text: point.id })]);
      })),
    ]);
  }

  function renderTimeline(items) {
    return h("div", { class: "timeline" }, items.map(function (item, index) {
      return h("div", { class: "timeline-row " + (index === items.length - 1 ? "pending" : "done") }, [
        h("span", { class: "time", text: item[0] }),
        h("span", { class: "line" }),
        h("strong", { text: item[1] }),
      ]);
    }));
  }

  function renderTrendChart() {
    var width = 760;
    var height = 330;
    var pad = { l: 54, r: 28, t: 26, b: 48 };
    var ys = DATA.trend.points.map(function (p) { return p.y; }).concat([DATA.thresholds.stopValue]);
    var max = Math.max.apply(null, ys) + 0.4;
    var min = 0;
    function x(i) {
      return pad.l + (i / (DATA.trend.points.length - 1)) * (width - pad.l - pad.r);
    }
    function y(v) {
      return height - pad.b - ((v - min) / (max - min)) * (height - pad.t - pad.b);
    }
    var path = DATA.trend.points.map(function (p, i) {
      return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(p.y).toFixed(1);
    }).join(" ");
    var pointNodes = DATA.trend.points.map(function (p, i) {
      return '<g><circle class="trend-point ' + (p.y >= DATA.thresholds.warningValue ? "warn" : "") + '" cx="' + x(i) + '" cy="' + y(p.y) + '" r="5"></circle><text class="axis-label" x="' + x(i) + '" y="' + (height - 18) + '" text-anchor="middle">' + p.t + '</text><text class="point-label" x="' + x(i) + '" y="' + (y(p.y) - 12) + '" text-anchor="middle">' + p.y.toFixed(2) + '</text></g>';
    }).join("");
    var svg = [
      '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="振动趋势图">',
      '<line class="axis" x1="' + pad.l + '" y1="' + (height - pad.b) + '" x2="' + (width - pad.r) + '" y2="' + (height - pad.b) + '"></line>',
      '<line class="axis" x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (height - pad.b) + '"></line>',
      thresholdLine(y(DATA.thresholds.warningValue), width, pad, "80%预警线 5.68", "warn"),
      thresholdLine(y(DATA.thresholds.stopValue), width, pad, "停机值 7.10", "danger"),
      '<path class="trend-line" d="' + path + '"></path>',
      pointNodes,
      '<text class="unit-label" x="16" y="24">' + DATA.trend.unit + '</text>',
      '</svg>',
    ].join("");
    return h("div", { class: "trend-chart", html: svg });
  }

  function thresholdLine(y, width, pad, label, tone) {
    return '<g><line class="threshold ' + tone + '" x1="' + pad.l + '" y1="' + y + '" x2="' + (width - pad.r) + '" y2="' + y + '"></line><text class="threshold-label ' + tone + '" x="' + (width - pad.r - 4) + '" y="' + (y - 8) + '" text-anchor="end">' + label + '</text></g>';
  }

  function renderSpectrumCard() {
    return h("section", { class: "panel mini-panel" }, [
      panelTitle("频谱卡", DATA.spectrum.pointId),
      h("div", { class: "spectrum-bars" }, DATA.spectrum.peaks.map(function (peak) {
        return h("button", {
          class: "spectrum-bar " + (peak.harmonic === "2X" ? "active" : ""),
          type: "button",
          dataset: { evidence: peak.harmonic },
          style: "--bar:" + Math.round(peak.amplitude * 100) + "%",
        }, [
          h("span", { class: "bar-fill" }),
          h("strong", { text: peak.harmonic }),
          h("em", { text: peak.hz + " Hz" }),
          h("small", { text: peak.label }),
        ]);
      })),
    ]);
  }

  function renderPhaseCard() {
    return h("section", { class: "panel mini-panel" }, [
      panelTitle("相位卡", "phase"),
      h("div", { class: "phase-list" }, DATA.phases.map(function (phase) {
        return h("button", { class: "phase-row", type: "button", dataset: { evidence: "phase" } }, [
          h("strong", { text: phase.pair }),
          h("span", { text: phase.delta + "° / r=" + phase.correlation }),
          h("small", { text: phase.verdict }),
        ]);
      })),
    ]);
  }

  function renderDiagnosisCard() {
    return h("section", { class: "panel diagnosis-card" }, [
      panelTitle("诊断结果", DATA.diagnosis.severity),
      h("div", { class: "diagnosis-result" }, [
        h("span", { class: "result-code", text: "MISALIGNMENT" }),
        h("strong", { text: DATA.diagnosis.result }),
        h("p", { text: DATA.diagnosis.explanation }),
      ]),
      h("div", { class: "tag-row" }, DATA.diagnosis.evidenceTags.map(function (tag) {
        return h("button", { class: "evidence-tag", type: "button", dataset: { evidence: tag }, text: tag });
      })),
    ]);
  }

  function renderKnowledgeItem(item) {
    return h("article", { class: "knowledge-item" }, [
      h("div", { class: "knowledge-type", text: item.type }),
      h("strong", { text: item.title }),
      h("p", { text: item.reason }),
      sourcePill("basis", item.basisSource),
    ]);
  }

  function renderStepList(steps) {
    return h("ol", { class: "step-list" }, steps.map(function (step, index) {
      var done = state.feedbackConfirmed || (state.ticketGenerated && index < 4);
      return h("li", { class: done ? "done" : "" }, [
        h("span", { text: String(index + 1).padStart(2, "0") }),
        h("p", { text: step }),
      ]);
    }));
  }

  function renderBeforeAfter() {
    return h("div", { class: "before-after" }, [
      h("div", { class: "compare-value before" }, [
        h("span", { text: "处置前" }),
        h("strong", { text: DATA.feedback.beforeVibration.toFixed(2) }),
        h("em", { text: "mm/s" }),
      ]),
      h("div", { class: "compare-arrow", text: "->" }),
      h("div", { class: "compare-value after" }, [
        h("span", { text: "复测后" }),
        h("strong", { text: DATA.feedback.afterVibration.toFixed(2) }),
        h("em", { text: "mm/s" }),
      ]),
      h("p", { text: state.feedbackConfirmed ? DATA.feedback.acceptance : "等待现场反馈和复测确认。" }),
    ]);
  }

  function renderCaseStatus() {
    var rows = [
      ["报告确认", state.reportConfirmed],
      ["知识审核", state.knowledgeApproved],
      ["案例可复用", state.knowledgeApproved],
    ];
    return h("div", { class: "audit-list" }, rows.map(function (row) {
      return h("div", { class: "audit-row " + (row[1] ? "ok" : "pending") }, [
        h("span", { text: row[0] }),
        h("strong", { text: row[1] ? "完成" : "待处理" }),
      ]);
    }));
  }

  function renderReuseCard() {
    if (!state.knowledgeApproved) {
      return h("div", { class: "reuse-card locked" }, [
        h("strong", { text: "P-2 复用验证未开启" }),
        h("p", { text: "P-1 报告确认并通过知识审核后，P-2 才能命中该案例。" }),
      ]);
    }
    return h("div", { class: "reuse-card" }, [
      h("span", { class: "badge ok", text: "命中案例" }),
      h("strong", { text: DATA.reuse.title }),
      h("p", { text: "命中 " + DATA.caseEntry.title }),
      h("div", { class: "tag-row" }, DATA.reuse.reasons.map(function (tag) {
        return h("span", { class: "evidence-tag static", text: tag });
      })),
      h("p", { class: "recommendation", text: DATA.reuse.recommendation }),
    ]);
  }

  function renderFlowStrip() {
    var nodes = [
      ["warning", "异常事件"],
      ["diagnosis", "诊断输出"],
      ["review", "专家复核"],
      ["work_order", "处置票卡"],
      ["feedback", "复测反馈"],
      ["report", "报告确认"],
      ["case_entry", "知识审核"],
      ["reuse", "复用验证"],
    ];
    var current = currentNode();
    var currentIndex = nodes.map(function (n) { return n[0]; }).indexOf(current);
    return h("div", { class: "flow-strip" }, nodes.map(function (node, index) {
      return h("div", { class: "flow-node " + (index <= currentIndex ? "done" : "") + (node[0] === current ? " current" : "") }, [
        h("span", { text: String(index + 1) }),
        h("strong", { text: node[1] }),
      ]);
    }));
  }

  function panelTitle(title, meta) {
    return h("div", { class: "panel-title" }, [
      h("span", { text: title }),
      h("em", { text: meta }),
    ]);
  }

  function sourcePill(type, text) {
    var label = type === "runtime" ? "演示映射" : "样例依据";
    return h("span", { class: "source-pill " + type, text: label + ": " + text });
  }

  function legendItem(label, tone) {
    return h("span", { class: "legend-item " + tone, text: label });
  }

  function miniBlock(label, text) {
    return h("div", { class: "mini-block" }, [
      h("span", { text: label }),
      h("strong", { text: text }),
    ]);
  }

  function imageFigure(src, label, alt) {
    return h("figure", {}, [
      h("img", { src: src, alt: alt }),
      h("figcaption", { text: label }),
    ]);
  }

  function bindStageButtons() {
    stage.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.dataset.action;
        if (button.disabled) return;
        if (action === "go-diagnosis") setScene("diagnosis");
        if (action === "go-knowledge") setScene("knowledge");
        if (action === "confirm-expert") {
          state.expertConfirmed = true;
          state.scene = "knowledge";
          saveState();
          render();
        }
        if (action === "generate-ticket") {
          if (!state.expertConfirmed) return;
          state.ticketGenerated = true;
          setScene("workorder");
        }
        if (action === "confirm-feedback") {
          if (!state.ticketGenerated) return;
          state.feedbackConfirmed = true;
          setScene("report");
        }
        if (action === "go-report") setScene("report");
        if (action === "confirm-report") {
          if (!state.feedbackConfirmed) return;
          state.reportConfirmed = true;
          saveState();
          render();
        }
        if (action === "approve-knowledge") {
          if (!state.reportConfirmed) return;
          state.knowledgeApproved = true;
          saveState();
          render();
        }
        if (action === "reset") resetState();
      });
    });

    stage.querySelectorAll("[data-point]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedPoint = button.dataset.point;
        saveState();
        render();
      });
    });

    stage.querySelectorAll("[data-evidence]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.evidence = button.dataset.evidence;
        button.classList.add("pulse");
        window.setTimeout(function () { button.classList.remove("pulse"); }, 320);
      });
    });
  }

  document.querySelector("[data-action='reset']").addEventListener("click", resetState);
  render();
})();
