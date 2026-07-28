(function () {
  "use strict";

  var DATA = window.PUMP_DEMO_DATA;
  if (!DATA) {
    throw new Error("PUMP_DEMO_DATA is required");
  }

  var STORAGE_KEY = "pump-demo-v3-state";
  var sceneOrder = DATA.scenes.map(function (scene) { return scene.key; });
  var statusText = {
    ok: "正常",
    warn: "关注",
    danger: "异常",
  };
  var allowedVerdicts = ["确认不对中", "继续观察", "排除误报"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var svgTags = ["svg", "line", "polyline", "circle", "g", "text"];

  var stage = document.getElementById("stage");
  var sceneNav = document.getElementById("sceneNav");
  var brandSub = document.getElementById("brandSub");
  var clock = document.getElementById("clock");
  var statusLine = document.getElementById("statusLine");

  var state = normalizeState(loadState() || defaultState());

  function defaultState() {
    return {
      scene: "overview",
      selectedUnit: "P-1",
      selectedPart: "coupling",
      detail: "",
      agentOpen: false,
      agentContext: "current",
      agentQuestion: "",
      expertVerdict: "",
      treatmentDone: false,
      observationDone: false,
      archived: false,
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      window.localStorage.removeItem(STORAGE_KEY);
      console.warn("Reset invalid pump demo state", err);
      return null;
    }
  }

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeState(candidate) {
    var clean = defaultState();
    Object.keys(clean).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(candidate, key)) {
        clean[key] = candidate[key];
      }
    });
    if (sceneOrder.indexOf(clean.scene) < 0) clean.scene = "overview";
    if (clean.selectedUnit !== "P-1" || !DATA.pumpUnits.some(function (unit) { return unit.id === clean.selectedUnit; })) {
      clean.selectedUnit = "P-1";
    }
    if (!DATA.parts.some(function (part) { return part.id === clean.selectedPart; })) {
      clean.selectedPart = "coupling";
    }
    clean.agentOpen = clean.agentOpen === true;
    clean.agentContext = ["current", "case", "record"].indexOf(clean.agentContext) >= 0 ? clean.agentContext : "current";
    clean.agentQuestion = typeof clean.agentQuestion === "string" ? clean.agentQuestion : "";
    if (clean.detail === "agent") {
      clean.detail = "";
      clean.agentOpen = true;
    }
    if (["trend", "vision", ""].indexOf(clean.detail) < 0) clean.detail = "";
    clean.expertVerdict = typeof clean.expertVerdict === "string" ? clean.expertVerdict : "";
    if (clean.expertVerdict !== "" && allowedVerdicts.indexOf(clean.expertVerdict) < 0) {
      clean.expertVerdict = "";
    }
    clean.treatmentDone = clean.treatmentDone === true && clean.expertVerdict === "确认不对中";
    clean.observationDone = clean.observationDone === true && isNonMaintenanceVerdict(clean.expertVerdict);
    clean.archived = clean.archived === true && (clean.treatmentDone || clean.observationDone);
    if (clean.agentContext === "case" && !canUseCaseAgentContextForState(clean)) clean.agentContext = "current";
    if (clean.agentContext === "record" && !canUseRecordAgentContextForState(clean)) clean.agentContext = "current";
    if (!clean.agentOpen) clean.agentQuestion = "";
    if (!canOpenForState(clean.scene, clean)) clean.scene = clean.expertVerdict ? "confirm" : "overview";
    return clean;
  }

  function isNonMaintenanceVerdict(verdict) {
    return verdict === "继续观察" || verdict === "排除误报";
  }

  function h(tag, attrs, children) {
    var isSvg = svgTags.indexOf(tag) >= 0;
    var node = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (key === "class") {
        if (isSvg) node.setAttribute("class", value);
        else node.className = value;
      }
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
      if (Array.isArray(child)) {
        append(node, child);
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
  }

  function selectedPart() {
    var part = DATA.parts.find(function (item) { return item.id === state.selectedPart; });
    if (!part) throw new Error("Missing selected pump part: " + state.selectedPart);
    return part;
  }

  function selectedUnit() {
    var unit = DATA.pumpUnits.find(function (item) { return item.id === state.selectedUnit; });
    if (!unit) throw new Error("Missing selected pump unit: " + state.selectedUnit);
    return unit;
  }

  function mediaSrc(key) {
    if (!DATA.media[key]) throw new Error("Missing media key: " + key);
    return DATA.media[key];
  }

  function canOpen(sceneKey) {
    return canOpenForState(sceneKey, state);
  }

  function canOpenForState(sceneKey, target) {
    if (sceneKey === "overview" || sceneKey === "workbench") return true;
    if (sceneKey === "confirm") return true;
    if (sceneKey === "treatment") return target.expertVerdict !== "" || target.treatmentDone || target.observationDone || target.archived;
    if (sceneKey === "archive") return target.treatmentDone || target.observationDone || target.archived;
    return false;
  }

  function canUseCaseAgentContextForState(target) {
    return target.archived === true && target.expertVerdict === "确认不对中";
  }

  function canUseRecordAgentContextForState(target) {
    return target.archived === true && isNonMaintenanceVerdict(target.expertVerdict);
  }

  function setScene(sceneKey) {
    if (sceneOrder.indexOf(sceneKey) < 0 || !canOpen(sceneKey)) return;
    state.scene = sceneKey;
    state.detail = "";
    state.agentOpen = false;
    state.agentQuestion = "";
    saveState();
    render();
    resetScroll();
    stage.focus();
  }

  function resetScroll() {
    stage.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function resetState() {
    window.localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    render();
    stage.focus();
  }

  function render() {
    brandSub.textContent = DATA.meta.subtitle + " · " + DATA.meta.batch;
    clock.textContent = DATA.meta.clock;
    statusLine.textContent = currentStatusLine();
    renderNav();
    stage.innerHTML = "";
    stage.appendChild(renderScene());
    stage.appendChild(renderAgentDrawer());
    bindStage();
  }

  function currentStatusLine() {
    if (state.archived && state.expertVerdict === "确认不对中") return "P-1 维修案例已归档，P-2 二次相似命中已解锁。";
    if (state.archived) return "非维修结论已归档为观察/模型反馈记录，不触发二次维修案例命中。";
    if (state.treatmentDone) return "处置票卡和复测证据已确认，可生成归档报告。";
    if (state.observationDone) return "非维修结论已形成闭环记录，可归档为观察/模型反馈样本。";
    if (state.expertVerdict === "确认不对中") return "专家已确认疑似不对中，待执行处置票卡和复测确认。";
    if (state.expertVerdict) return "专家已选择非维修结论，待生成观察记录或误报反馈。";
    if (state.scene === "confirm") return "已进入专家复核，请选择诊断结论和处置路径。";
    if (state.scene === "workbench") return "工作台已加载时序、视觉、规则和 Agent 证据。";
    return "本轮 P-1 关注级异常已加载，请从部位态势进入诊断工作台。";
  }

  function renderNav() {
    sceneNav.innerHTML = "";
    DATA.scenes.forEach(function (scene, index) {
      var locked = !canOpen(scene.key);
      var active = state.scene === scene.key;
      var button = h("button", {
        type: "button",
        class: "scene-button " + (active ? "active " : "") + (locked ? "locked" : ""),
        disabled: locked,
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
    if (state.scene === "overview") return renderOverview();
    if (state.scene === "workbench") return renderWorkbench();
    if (state.scene === "confirm") return renderConfirm();
    if (state.scene === "treatment") return renderTreatment();
    return renderArchive();
  }

  function pageShell(kicker, title, action, body) {
    return h("section", { class: "scene-shell" }, [
      h("div", { class: "scene-head" }, [
        h("div", {}, [
          h("p", { class: "kicker", text: kicker }),
          h("h2", { text: title }),
        ]),
        action || renderStatusStack(),
      ]),
      body,
      renderFlowStrip(),
    ]);
  }

  function renderStatusStack() {
    return h("div", { class: "status-stack" }, [
      statusPill("工作台", true),
      statusPill("专家确认", state.expertVerdict !== ""),
      statusPill(isNonMaintenanceVerdict(state.expertVerdict) ? "结论闭环" : "处置复测", state.treatmentDone || state.observationDone),
      statusPill("案例归档", state.archived),
    ]);
  }

  function statusPill(label, ok) {
    return h("span", { class: "status-pill " + (ok ? "done" : "pending"), text: label + (ok ? " 已完成" : " 待完成") });
  }

  function panelTitle(title, meta) {
    return h("div", { class: "panel-title" }, [
      h("span", { text: title }),
      h("small", { text: meta }),
    ]);
  }

  function renderOverview() {
    var part = selectedPart();
    return h("section", { class: "scene-shell overview-shell" }, [
      h("div", { class: "overview-head" }, [
        h("div", {}, [
          h("p", { class: "kicker", text: "任务总览 / 轴系部位" }),
          h("h2", { text: "P-1 输油泵机组部位态势大屏" }),
        ]),
        h("div", { class: "overview-kpis" }, DATA.task.metrics.slice(0, 3).map(function (metric) {
          return h("div", {}, [
            h("span", { text: metric.label }),
            h("strong", { text: metric.value + metric.unit }),
          ]);
        })),
        h("button", { type: "button", class: "primary-action", dataset: { action: "go-workbench" }, text: "进入诊断工作台" }),
      ]),
      h("div", { class: "overview-screen" }, [
        h("aside", { class: "panel home-summary-panel" }, [
          panelTitle("本轮任务", DATA.task.batch),
          h("div", { class: "home-task-title" }, [
            h("strong", { text: "长岭站 P-1" }),
            h("span", { text: "关注级 · 疑似不对中" }),
          ]),
          h("div", { class: "home-task-rows" }, DATA.task.rows.slice(0, 3).map(function (row) {
            return h("div", {}, [h("span", { text: row[0] }), h("b", { text: row[1] })]);
          })),
          h("div", { class: "home-unit-strip" }, [
            h("button", {
              type: "button",
              class: "home-unit active danger",
              dataset: { unit: "P-1" },
            }, [
              h("strong", { text: "P-1" }),
              h("span", { text: "异常 · 5.82 mm/s" }),
            ]),
            h("div", { class: "home-unit-compare" }, [
              h("span", { text: "对比样本" }),
              h("strong", { text: "P-2 / P-3 / P-4" }),
            ]),
          ]),
        ]),
        h("section", { class: "panel train-panel home-train-panel" }, [
          h("div", { class: "home-train-title" }, [
            h("div", {}, [
              h("span", { text: "P-1 机组部位总览" }),
              h("strong", { text: "泵体 / 联轴器 / 轴承 / 电机 / 底座" }),
            ]),
            h("div", { class: "train-legend" }, [
              legend("danger", "异常"),
              legend("warn", "关注"),
              legend("ok", "对照"),
            ]),
          ]),
          renderPumpTrain(part.id),
        ]),
        h("aside", { class: "panel home-event-panel" }, [
          panelTitle("当前事件", "EVT-CL-P1-ALIGN-0722"),
          h("div", { class: "home-event-status" }, [
            h("span", { class: "badge " + part.status, text: part.badge }),
            h("strong", { text: part.label }),
            h("small", { text: part.component }),
          ]),
          h("p", { class: "home-event-line", text: part.id === "coupling" ? "相位差与 2X 成分并发，建议进入工作台联判。" : part.summary }),
          h("div", { class: "home-evidence-chips" }, part.evidence.slice(0, 2).map(function (item) {
            return h("span", { text: item });
          })),
          h("div", { class: "home-actions" }, [
            h("button", { type: "button", class: "primary-action", dataset: { action: "go-workbench" }, text: "查看模型证据" }),
          ]),
        ]),
      ]),
      renderHomeFlow(),
    ]);
  }

  function renderHomeFlow() {
    return h("div", { class: "home-flow", "aria-label": "首页演示流程" }, [
      ["大屏", "部位态势"],
      ["工作台", "证据矩阵"],
      ["时序", "模型详情"],
      ["视觉/数据", "模型详情"],
      ["Agent", "辅助问答"],
      ["归档", "二次命中"],
    ].map(function (step, index) {
      return h("div", { class: "home-flow-step " + (index === 0 ? "active" : "") }, [
        h("span", { text: String(index + 1).padStart(2, "0") }),
        h("strong", { text: step[0] }),
        h("small", { text: step[1] }),
      ]);
    }));
  }

  function renderPumpTrain(activeId) {
    return h("div", { class: "pump-train", role: "img", "aria-label": "输油泵机组部位示意图" }, [
      h("div", { class: "machine-line" }),
      h("div", { class: "machine-base" }),
      h("div", { class: "part-shape motor-shape" }, [h("span", { text: "电机" })]),
      h("div", { class: "part-shape coupling-shape" }, [h("span", { text: "联轴器" })]),
      h("div", { class: "part-shape pump-shape" }, [h("span", { text: "泵体" })]),
      h("div", { class: "part-shape pipe-shape pipe-left" }),
      h("div", { class: "part-shape pipe-shape pipe-right" }),
      h("div", { class: "part-shape seal-shape" }),
      h("div", { class: "part-shape bearing-shape" }),
      DATA.parts.map(function (part) {
        return h("button", {
          type: "button",
          class: "part-pin " + part.status + (part.id === activeId ? " active" : ""),
          style: "left:" + part.position.x / 9 + "%;top:" + part.position.y / 5.1 + "%;",
          dataset: { part: part.id },
          title: part.label + " · " + statusText[part.status],
        }, [
          h("span", { class: "pin-core" }),
          h("span", { class: "pin-label", text: part.short }),
        ]);
      }),
    ]);
  }

  function legend(status, label) {
    return h("span", {}, [h("i", { class: "dot " + status }), h("span", { text: label })]);
  }

  function renderWorkbench() {
    var part = selectedPart();
    if (state.detail) return renderModelDetailPage(part);
    return pageShell(
      "诊断工作台 / 模型证据",
      part.label + "证据会聚工作台",
      h("button", { type: "button", class: "primary-action", dataset: { action: "go-confirm" }, text: "进入专家复核" }),
      h("div", { class: "workbench-stack" }, [
        h("div", { class: "workbench-grid" }, [
          renderScopePanel(part),
          renderDiagnosisMatrix(part),
          renderConclusionPanel(part),
        ]),
        renderSignalCards(part),
        renderAssistRow(part),
      ])
    );
  }

  function renderScopePanel(part) {
    return h("aside", { class: "panel scope-panel" }, [
      panelTitle("机组范围", selectedUnit().id),
      h("div", { class: "scope-unit" }, [
        h("strong", { text: selectedUnit().name }),
        h("span", { text: "当前状态：" + selectedUnit().status }),
        h("small", { text: "负荷 " + selectedUnit().load + " · 振动 " + selectedUnit().vibration }),
      ]),
      h("div", { class: "part-list" }, DATA.parts.map(function (item) {
        return h("button", {
          type: "button",
          class: "part-row " + item.status + (item.id === part.id ? " active" : ""),
          dataset: { part: item.id },
        }, [
          h("span", { class: "dot " + item.status }),
          h("strong", { text: item.label }),
          h("small", { text: item.badge }),
        ]);
      })),
      h("div", { class: "asset-box" }, [
        h("span", { text: "可用数据资产" }),
        h("b", { text: "时序趋势 / 频谱相位 / 点位图 / 激光对中 / 作业卡 / 历史报告" }),
      ]),
    ]);
  }

  function renderDiagnosisMatrix(activePart) {
    return h("section", { class: "panel matrix-panel" }, [
      panelTitle("部位诊断矩阵", "part diagnosis"),
      h("div", { class: "matrix-table" }, [
        h("div", { class: "matrix-head" }, [
          h("span", { text: "部位" }),
          h("span", { text: "当前指标" }),
          h("span", { text: "关键特征" }),
          h("span", { text: "状态" }),
        ]),
        DATA.parts.map(function (part) {
          var current = part.trend.points[part.trend.points.length - 1][1] + " " + part.trend.unit;
          return h("button", {
            type: "button",
            class: "matrix-row " + part.status + (part.id === activePart.id ? " active" : ""),
            dataset: { part: part.id },
          }, [
            h("span", { text: part.label }),
            h("span", { text: current }),
            h("span", { text: part.evidence[0] }),
            h("span", { class: "badge " + part.status, text: statusText[part.status] }),
          ]);
        }),
      ]),
    ]);
  }

  function renderConclusionPanel(part) {
    return h("aside", { class: "panel conclusion-panel" }, [
      panelTitle("AI 诊断结论", "evidence convergence"),
      h("h3", { text: part.status === "danger" ? "证据会聚：疑似不对中" : "证据对照：" + part.label }),
      h("p", { class: "muted", text: part.summary }),
      h("div", { class: "convergence-list" }, [
        convergence("主证据", part.trend.alert, part.status),
        convergence("视觉证据", part.vision.finding, part.vision.compareSrc ? "warn" : part.status),
        convergence("规则命中", part.agent, part.status === "ok" ? "ok" : "danger"),
      ]),
      h("div", { class: "knowledge-mini" }, DATA.knowledgeHits.slice(0, 3).map(function (hit) {
        return h("div", {}, [
          h("span", { text: hit.type }),
          h("strong", { text: hit.title }),
          h("small", { text: hit.reason }),
        ]);
      })),
    ]);
  }

  function convergence(label, text, status) {
    return h("div", { class: "convergence-item " + status }, [
      h("span", { class: "dot " + status }),
      h("div", {}, [h("strong", { text: label }), h("p", { text: text })]),
    ]);
  }

  function renderAssistRow(part) {
    return h("div", { class: "assist-row" }, [
      h("section", { class: "panel assist-card" }, [
        panelTitle("时序模型预警", "trend model"),
        miniChart(part.trend, "mini"),
        h("p", { text: part.trend.alert }),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-trend-detail" }, text: "查看时序详情" }),
      ]),
      h("section", { class: "panel assist-card" }, [
        panelTitle("视觉/数据模型详情", "vision & data model"),
        h("img", { class: "thumb", src: mediaSrc(part.vision.src), alt: part.vision.title }),
        h("p", { text: part.vision.finding }),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-vision-detail" }, text: "查看视觉/数据详情" }),
      ]),
      h("section", { class: "panel assist-card" }, [
        panelTitle("Agent 辅助问答", "agent"),
        h("p", { text: part.agent }),
        h("div", { class: "agent-chips" }, [
          h("span", { text: "当前振动证据" }),
          h("span", { text: "对中作业卡" }),
          h("span", { class: state.archived ? "" : "locked", text: state.archived ? "归档结果" : "归档后可用" }),
        ]),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-agent-detail" }, text: "查看诊断问答" }),
      ]),
    ]);
  }

  function renderSignalCards(part) {
    var cards = part.id === "coupling" ? [
      ["2X 频谱", "二倍频成分突出", "主证据"],
      ["相位差", "-81.06° / r=0.97", "强相关"],
      ["基础振动", "3.36 mm/s", "并发证据"],
      ["测点组合", "P-DE-V + 联轴器 + F 点", "联判"],
    ] : [
      ["趋势", part.trend.alert, "模型"],
      ["测点", part.checkItem, "来源"],
      ["视觉", part.vision.finding, "现场"],
      ["规则", part.badge, "结论"],
    ];
    return h("div", { class: "signal-row" }, cards.map(function (card) {
      return h("section", { class: "panel signal-card" }, [
        h("span", { text: card[2] }),
        h("strong", { text: card[0] }),
        h("p", { text: card[1] }),
      ]);
    }));
  }

  function renderModelDetailPage(part) {
    var trend = state.detail === "trend";
    var title = trend ? "时序模型详情 · " + part.label : "视觉/数据模型详情 · " + part.label;
    return pageShell(
      trend ? "诊断工作台 / 时序模型" : "诊断工作台 / 视觉数据",
      title,
      h("div", { class: "detail-actions" }, [
        h("button", { type: "button", class: "plain-button", dataset: { action: "close-detail" }, text: "返回工作台" }),
        h("button", { type: "button", class: "primary-action", dataset: { action: "go-confirm" }, text: "进入专家复核" }),
      ]),
      h("div", { class: "model-detail-stack" }, [
        renderDetailContext(part, trend),
        h("section", { class: "panel model-detail-panel" }, [
          panelTitle(trend ? "时序模型预警" : "视觉/数据证据", trend ? "trend model" : "vision & data model"),
          trend ? renderTrendDetail(part) : renderVisionDetail(part),
        ]),
        renderDetailEvidenceRail(part),
      ])
    );
  }

  function renderDetailContext(part, trend) {
    return h("div", { class: "detail-context-row" }, [
      h("section", { class: "panel detail-context-card" }, [
        panelTitle("当前部位", selectedUnit().id),
        h("strong", { text: part.label }),
        h("p", { text: part.component }),
        h("span", { class: "badge " + part.status, text: part.badge }),
      ]),
      h("section", { class: "panel detail-context-card wide" }, [
        panelTitle(trend ? "模型判断" : "现场证据", trend ? part.trend.title : part.vision.title),
        h("strong", { text: trend ? part.trend.alert : part.vision.finding }),
        h("p", { text: part.summary }),
      ]),
      h("section", { class: "panel detail-context-card" }, [
        panelTitle("下一步", "workflow"),
        h("strong", { text: "回到工作台联判" }),
        h("p", { text: "详情只解释单类证据，最终结论仍由工作台汇总后进入专家复核。" }),
      ]),
    ]);
  }

  function renderDetailEvidenceRail(part) {
    return h("div", { class: "detail-evidence-rail" }, [
      h("section", { class: "panel detail-rail-card" }, [
        panelTitle("证据标签", "features"),
        h("div", { class: "feature-cards" }, part.evidence.map(function (item) {
          return h("span", { text: item });
        })),
      ]),
      h("section", { class: "panel detail-rail-card" }, [
        panelTitle("Agent 建议", "assistant"),
        h("p", { text: part.agent }),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-agent-detail" }, text: "查看诊断问答" }),
      ]),
    ]);
  }

  function renderTrendDetail(part) {
    return h("div", { class: "detail-grid trend-detail" }, [
      h("div", { class: "chart-large" }, [miniChart(part.trend, "large")]),
      h("div", { class: "detail-side" }, [
        h("h4", { text: part.trend.title }),
        h("p", { text: part.trend.alert }),
        h("div", { class: "sample-table" }, [
          h("div", { class: "sample-head" }, [h("span", { text: "日期" }), h("span", { text: "数值" })]),
          part.trend.points.map(function (point) {
            return h("div", {}, [h("span", { text: point[0] }), h("strong", { text: point[1] + " " + part.trend.unit })]);
          }),
        ]),
        h("div", { class: "feature-cards" }, part.evidence.map(function (item) {
          return h("span", { text: item });
        })),
      ]),
    ]);
  }

  function renderVisionDetail(part) {
    var images = [
      h("figure", {}, [
        h("img", { src: mediaSrc(part.vision.src), alt: part.vision.title }),
        h("figcaption", { text: part.vision.caption }),
      ]),
    ];
    if (part.vision.compareSrc) {
      images.push(h("figure", {}, [
        h("img", { src: mediaSrc(part.vision.compareSrc), alt: part.vision.title + "复测" }),
        h("figcaption", { text: "处置复测图，用于归档对比。" }),
      ]));
    }
    return h("div", { class: "detail-grid vision-detail" }, [
      h("div", { class: "vision-gallery" }, images),
      h("div", { class: "detail-side" }, [
        h("h4", { text: part.vision.title }),
        h("p", { text: part.vision.finding }),
        h("ul", { class: "bullet-list" }, [
          h("li", { text: "拍摄位置：" + part.component }),
          h("li", { text: "关联测点：" + part.checkItem }),
          h("li", { text: "用途：支撑专家确认和报告归档，不替代现场复核。" }),
        ]),
      ]),
    ]);
  }

  function renderConfirm() {
    var part = selectedPart();
    return pageShell(
      "专家复核 / 知识规范",
      isNonMaintenanceVerdict(state.expertVerdict) ? "专家确认与结论闭环" : "专家确认与处置票卡",
      h("button", {
        type: "button",
        class: "primary-action",
        disabled: state.expertVerdict === "",
        dataset: { action: "go-treatment" },
        text: verdictActionText(),
      }),
      h("div", { class: "confirm-grid" }, [
        h("section", { class: "panel evidence-summary" }, [
          panelTitle("核心证据", part.label),
          h("h3", { text: part.summary }),
          h("div", { class: "evidence-list" }, part.evidence.map(function (item) {
            return h("div", {}, [h("span", { class: "dot " + part.status }), h("span", { text: item })]);
          })),
          miniChart(part.trend, "mini"),
        ]),
        h("section", { class: "panel knowledge-panel" }, [
          panelTitle("知识命中", "rules & cards"),
          DATA.knowledgeHits.map(function (hit) {
            return h("div", { class: "knowledge-hit" }, [
              h("span", { class: "badge warn", text: hit.type }),
              h("strong", { text: hit.title }),
              h("p", { text: hit.reason }),
              h("small", { text: hit.source }),
            ]);
          }),
        ]),
        h("aside", { class: "panel verdict-panel" }, [
          panelTitle("专家结论", DATA.workOrder.id),
          h("div", { class: "verdict-options" }, [
            verdictButton("确认不对中"),
            verdictButton("继续观察"),
            verdictButton("排除误报"),
          ]),
          renderVerdictNextBox(),
        ]),
      ])
    );
  }

  function renderVerdictNextBox() {
    if (state.expertVerdict === "继续观察") {
      return h("div", { class: "workorder-box" }, [
        h("h4", { text: "继续观察闭环" }),
        h("ol", {}, ["生成观察记录", "设置 48h 趋势复评窗口", "归档观察记录", "不触发维修案例命中"].map(function (step) { return h("li", { text: step }); })),
      ]);
    }
    if (state.expertVerdict === "排除误报") {
      return h("div", { class: "workorder-box" }, [
        h("h4", { text: "误报反馈闭环" }),
        h("ol", {}, ["记录排除依据", "生成模型反馈标签", "归档误报样本", "不生成处置票卡"].map(function (step) { return h("li", { text: step }); })),
      ]);
    }
    return h("div", { class: "workorder-box" }, [
      h("h4", { text: DATA.workOrder.title }),
      h("ol", {}, DATA.workOrder.steps.map(function (step) { return h("li", { text: step }); })),
    ]);
  }

  function verdictButton(label) {
    return h("button", {
      type: "button",
      class: "verdict-button " + (state.expertVerdict === label ? "active" : ""),
      dataset: { verdict: label },
    }, [
      h("strong", { text: label }),
      h("span", { text: verdictHint(label) }),
    ]);
  }

  function verdictActionText() {
    if (state.expertVerdict === "确认不对中") return "生成处置票卡";
    if (state.expertVerdict === "继续观察") return "生成观察记录";
    if (state.expertVerdict === "排除误报") return "生成误报反馈";
    return "请选择专家结论";
  }

  function verdictHint(label) {
    if (label === "确认不对中") return "生成处置票卡并进入复测闭环";
    if (label === "继续观察") return "生成观察记录，不触发维修案例命中";
    return "生成误报反馈，沉淀为模型反馈样本";
  }

  function renderTreatment() {
    if (isNonMaintenanceVerdict(state.expertVerdict)) return renderConclusionClosure();
    return pageShell(
      "处置闭环 / 票卡复测",
      "P-1 不对中处置票卡与复测反馈",
      h("button", { type: "button", class: "primary-action", disabled: !state.treatmentDone, dataset: { action: "go-archive" }, text: "进入报告归档" }),
      h("div", { class: "treatment-grid" }, [
        h("section", { class: "panel ticket-panel" }, [
          panelTitle("处置票卡", DATA.workOrder.id),
          h("h3", { text: DATA.workOrder.title }),
          h("div", { class: "role-row" }, DATA.workOrder.roles.map(function (role) { return h("span", { text: role }); })),
          h("ol", { class: "ticket-steps" }, DATA.workOrder.steps.map(function (step) { return h("li", { text: step }); })),
        ]),
        h("section", { class: "panel compare-panel" }, [
          panelTitle("激光对中前后对比", "visual evidence"),
          h("div", { class: "compare-images" }, [
            h("figure", {}, [
              h("img", { src: mediaSrc("laserBefore"), alt: "激光对中调整前" }),
              h("figcaption", { text: "调整前：相位差和对中偏差作为处置前证据。" }),
            ]),
            h("figure", {}, [
              h("img", { src: mediaSrc("laserAfter"), alt: "激光对中调整后" }),
              h("figcaption", { text: "调整后：用于报告归档和案例复用的复测证据。" }),
            ]),
          ]),
        ]),
        h("aside", { class: "panel feedback-panel" }, [
          panelTitle("复测验收", "feedback"),
          h("div", { class: "feedback-cards" }, [
            feedback("振动回落", "5.82 -> 1.80 mm/s"),
            feedback("相位复核", "-81.06° -> -12.4°"),
            feedback("验收结论", "满足演示验收口径"),
          ]),
          h("button", { type: "button", class: "primary-action", disabled: state.treatmentDone, dataset: { action: "confirm-treatment" }, text: state.treatmentDone ? "复测已确认" : "确认复测反馈" }),
        ]),
      ])
    );
  }

  function feedback(label, value) {
    return h("div", {}, [h("span", { text: label }), h("strong", { text: value })]);
  }

  function renderConclusionClosure() {
    var isObserve = state.expertVerdict === "继续观察";
    return pageShell(
      "结论闭环 / 非维修路径",
      isObserve ? "P-1 继续观察记录" : "P-1 误报反馈记录",
      h("button", { type: "button", class: "primary-action", disabled: !state.observationDone, dataset: { action: "go-archive" }, text: "进入结论归档" }),
      h("div", { class: "closure-grid" }, [
        h("section", { class: "panel closure-panel" }, [
          panelTitle("专家结论", isObserve ? "observe" : "false positive"),
          h("h3", { text: state.expertVerdict }),
          h("p", { text: isObserve ? "保留当前证据链，设置观察窗口和复评条件，不生成维修处置票卡。" : "记录排除依据并反馈模型标签，不进入维修处置票卡。" }),
          h("div", { class: "closure-tags" }, (isObserve ? ["48h 观察窗口", "振动趋势复评", "不触发维修案例"] : ["误报反馈", "样本回流", "不触发处置票卡"]).map(function (tag) {
            return h("span", { text: tag });
          })),
        ]),
        h("section", { class: "panel closure-panel" }, [
          panelTitle("依据摘要", selectedPart().label),
          h("div", { class: "evidence-list" }, selectedPart().evidence.slice(0, 3).map(function (item) {
            return h("div", {}, [h("span", { class: "dot warn" }), h("span", { text: item })]);
          })),
          h("p", { class: "muted", text: isObserve ? "本轮仅形成观察记录，后续由 Agent 在复评窗口内提醒复核。" : "本轮形成误报样本，用于后续模型阈值和规则解释优化。" }),
        ]),
        h("aside", { class: "panel closure-panel" }, [
          panelTitle("闭环动作", "archive ready"),
          h("div", { class: "feedback-cards" }, [
            feedback(isObserve ? "观察窗口" : "反馈类型", isObserve ? "48h / 趋势复评" : "模型误报样本"),
            feedback("处置票卡", "不生成"),
            feedback("二次命中", "不解锁维修案例"),
          ]),
          h("button", { type: "button", class: "primary-action", disabled: state.observationDone, dataset: { action: "confirm-observation" }, text: state.observationDone ? "闭环已确认" : "确认闭环记录" }),
        ]),
      ])
    );
  }

  function renderArchive() {
    var maintenance = state.expertVerdict === "确认不对中";
    return pageShell(
      maintenance ? "报告归档 / 案例复用" : "结论归档 / 模型反馈",
      maintenance ? DATA.report.title : nonMaintenanceArchiveTitle(),
      h("button", { type: "button", class: "primary-action", disabled: state.archived, dataset: { action: "archive-report" }, text: state.archived ? "已归档" : "确认归档" }),
      h("div", { class: "archive-stack" }, [
        h("div", { class: "archive-grid" }, [
          h("section", { class: "panel report-panel" }, [
            panelTitle(maintenance ? "报告草稿" : "归档记录", maintenance ? "six sections" : "light record"),
            archiveSections().map(function (section, index) {
              return h("article", { class: "report-section" }, [
                h("span", { text: String(index + 1).padStart(2, "0") }),
                h("div", {}, [h("h3", { text: section[0] }), h("p", { text: section[1] })]),
              ]);
            }),
          ]),
          h("aside", { class: "panel archive-side" }, [
            panelTitle("归档状态", "case entry"),
            h("div", { class: "case-card " + (state.archived ? "ready" : "") }, [
              h("strong", { text: state.archived ? archiveCaseId() : "等待归档确认" }),
              h("p", { text: state.archived ? archiveStatusText() : "闭环确认后，记录可归档进入知识库。" }),
            ]),
            h("div", { class: "tag-cloud" }, archiveTags().map(function (tag) {
              return h("span", { text: tag });
            })),
            maintenance && state.archived ? renderArchivedCaseContext() : null,
          ]),
        ]),
        renderReuseCard(),
      ])
    );
  }

  function nonMaintenanceArchiveTitle() {
    return state.expertVerdict === "继续观察" ? "长岭站 P-1 输油泵观察记录归档" : "长岭站 P-1 输油泵误报反馈归档";
  }

  function archiveSections() {
    if (state.expertVerdict === "确认不对中") return DATA.report.sections;
    if (state.expertVerdict === "继续观察") {
      return [
        ["专家结论", "本轮不生成处置票卡，进入 48h 趋势观察和复评窗口。"],
        ["保留证据", "保留相位差、2X 成分和基础振动证据，作为后续复评上下文。"],
        ["Agent 动作", "Agent 在观察窗口内提醒复评，不触发 P-2 维修案例命中。"],
      ];
    }
    return [
      ["专家结论", "本轮排除维修处置，形成模型误报反馈记录。"],
      ["排除依据", "专家确认当前证据不足以生成处置票卡，保留为阈值解释样本。"],
      ["模型反馈", "样本进入规则和模型反馈池，不触发二次维修案例命中。"],
    ];
  }

  function archiveTags() {
    if (state.expertVerdict === "确认不对中") return ["不对中", "2X频谱", "相位差异常", "基础振动", "激光对中", "输油泵"];
    if (state.expertVerdict === "继续观察") return ["继续观察", "48h复评", "趋势保留", "不生成票卡"];
    return ["排除误报", "模型反馈", "阈值解释", "不生成票卡"];
  }

  function archiveCaseId() {
    if (state.expertVerdict === "确认不对中") return DATA.reuse.matchedCase;
    return state.expertVerdict === "继续观察" ? "OBS-CL-P1-0722" : "FP-CL-P1-0722";
  }

  function archiveStatusText() {
    if (state.expertVerdict === "确认不对中") return "已沉淀为相似异常检索案例。";
    if (state.expertVerdict === "继续观察") return "已归档为观察记录，不解锁维修案例复用。";
    return "已归档为误报反馈样本，不解锁维修处置复用。";
  }

  function renderReuseCard() {
    var canReuse = state.archived && state.expertVerdict === "确认不对中";
    var buttonText = canReuse ? "查看 P-2 命中建议" : state.archived ? "查看归档记录问答" : "查看当前 Agent 解释";
    return h("section", { class: "panel reuse-panel " + (canReuse ? "unlocked" : "locked") }, [
      panelTitle("二次 Agent 命中预览", canReuse ? "P-2 reused" : "locked"),
      h("div", { class: "reuse-grid" }, [
        h("div", {}, [
          h("h3", { text: canReuse ? "二次 Agent 命中 · " + DATA.reuse.title : DATA.reuse.title }),
          h("p", { text: reuseText(canReuse) }),
          h("button", {
            type: "button",
            class: "plain-button",
            dataset: { action: canReuse ? "open-agent-case" : state.archived ? "open-agent-record" : "open-agent-detail" },
            text: buttonText,
          }),
        ]),
        h("div", { class: "reuse-tags" }, DATA.reuse.reasons.map(function (reason) { return h("span", { text: reason }); })),
        h("div", { class: "case-id", text: canReuse ? DATA.reuse.matchedCase : "未解锁" }),
      ]),
    ]);
  }

  function reuseText(canReuse) {
    if (canReuse) return DATA.caseKnowledge.secondPass.summary;
    if (state.archived && isNonMaintenanceVerdict(state.expertVerdict)) return "本轮为非维修闭环，仅归档观察/误报记录，不触发 P-2 维修案例命中。";
    return "完成 P-1 维修处置案例归档后，P-2 相似异常命中才会解锁。";
  }

  function renderArchivedCaseContext() {
    var archived = DATA.caseKnowledge.archivedCase;
    return h("div", { class: "archive-case-context" }, [
      h("strong", { text: archived.label }),
      h("p", { text: archived.summary }),
      h("div", { class: "archive-source-list" }, archived.sources.slice(0, 4).map(function (source) {
        return h("span", { text: source.text });
      })),
      h("div", { class: "archive-fact-list" }, archived.facts.slice(0, 4).map(function (fact) {
        return h("small", { text: fact });
      })),
    ]);
  }

  function renderAgentDrawer() {
    var part = selectedPart();
    var canCase = canUseCaseAgentContextForState(state);
    var canRecord = canUseRecordAgentContextForState(state);
    var knowledge = agentDrawerKnowledge(part);
    var archiveContext = canCase ? "case" : "record";
    var archiveContextActive = state.agentContext === "case" || state.agentContext === "record";
    var archiveContextLabel = canCase ? "已归档案例" : canRecord ? "已归档记录" : "归档结果";
    return h("div", { class: "agent-layer " + (state.agentOpen ? "open" : ""), "aria-hidden": state.agentOpen ? "false" : "true" }, [
      h("div", { class: "agent-mask", dataset: { action: "close-agent-drawer" } }),
      h("aside", { class: "panel agent-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Agent 辅助问答", tabindex: "-1" }, [
        h("div", { class: "agent-drawer-head" }, [
          h("div", {}, [
            h("p", { class: "kicker", text: "Agent 辅助问答" }),
            h("h3", { text: agentDrawerTitle() }),
          ]),
          h("button", { type: "button", class: "tool-btn", dataset: { action: "close-agent-drawer" }, text: "关闭" }),
        ]),
        h("div", { class: "agent-drawer-context" }, [
          h("span", { class: "badge " + (knowledge.caseId ? "ok" : part.status), text: knowledge.mode }),
          knowledge.caseId ? h("strong", { text: knowledge.caseId }) : h("strong", { text: selectedUnit().id + " · " + part.label }),
          h("small", { text: knowledge.summary }),
        ]),
        h("div", { class: "agent-context-toggle", role: "group", "aria-label": "Agent 问答上下文" }, [
          h("button", {
            type: "button",
            class: "context-toggle " + (state.agentContext === "current" ? "active" : ""),
            dataset: { agentContext: "current" },
            "aria-pressed": state.agentContext === "current" ? "true" : "false",
            text: "当前诊断",
          }),
          h("button", {
            type: "button",
            class: "context-toggle " + (archiveContextActive ? "active" : ""),
            dataset: { agentContext: archiveContext },
            "aria-pressed": archiveContextActive ? "true" : "false",
            disabled: canCase || canRecord ? null : true,
            title: canCase ? "查看已归档案例增强问答" : canRecord ? "查看已归档观察/误报记录" : "归档后可用",
            text: archiveContextLabel,
          }),
        ]),
        h("div", { class: "agent-sources" }, knowledge.sources.map(function (source) {
          return h("span", { class: "agent-source " + source.kind, text: source.text });
        })),
        knowledge.facts && knowledge.facts.length ? h("div", { class: "agent-facts" }, [
          h("strong", { text: knowledge.caseId ? "增强上下文" : "诊断事实" }),
          knowledge.facts.slice(0, 8).map(function (fact) {
            return h("span", { text: fact });
          }),
        ]) : null,
        h("div", { class: "agent-questions" }, knowledge.questions.map(function (item) {
          return h("button", {
            type: "button",
            class: "agent-question " + (state.agentQuestion === item.key ? "active" : ""),
            dataset: { agentQuestion: item.key },
            text: item.q,
          });
        })),
        h("div", { class: "agent-answer", "aria-live": "polite" }, [
          h("span", { text: "Agent" }),
          h("p", { text: agentAnswerText(knowledge) }),
        ]),
        h("div", { class: "agent-drawer-foot" }, [
          h("button", { type: "button", class: "plain-button", dataset: { action: "go-confirm" }, text: "进入专家复核" }),
          h("button", { type: "button", class: "primary-action", dataset: { action: "close-agent-drawer" }, text: state.scene === "archive" || state.detail ? "关闭问答" : "回到工作台" }),
        ]),
      ]),
    ]);
  }

  function agentDrawerKnowledge(part) {
    if (state.agentContext === "case" && canUseCaseAgentContextForState(state)) {
      var secondPass = caseKnowledgeBlock(DATA.caseKnowledge.secondPass, DATA.caseKnowledge.caseId, DATA.caseKnowledge.title);
      secondPass.facts = DATA.caseKnowledge.secondPass.facts.concat(DATA.caseKnowledge.archivedCase.facts.slice(0, 3));
      return secondPass;
    }
    if (state.agentContext === "record" && canUseRecordAgentContextForState(state)) {
      var observe = state.expertVerdict === "继续观察";
      var recordId = archiveCaseId();
      return {
        context: "record",
        mode: observe ? "观察记录已归档" : "误报反馈已归档",
        caseId: recordId,
        summary: archiveStatusText(),
        sources: [
          { kind: "report", text: recordId },
          { kind: "rule", text: observe ? "48h趋势复评窗口" : "模型阈值反馈" },
          { kind: "workcard", text: observe ? "观察记录" : "误报反馈样本" },
        ],
        questions: [
          { key: "record-why", q: "为什么不触发维修案例命中？", a: "本轮专家结论为“" + state.expertVerdict + "”，归档对象是" + (observe ? "趋势观察记录" : "误报反馈样本") + "，不是维修处置案例，因此不解锁 P-2 维修案例命中。" },
          { key: "record-next", q: observe ? "观察窗口里重点看什么？" : "误报反馈会怎么使用？", a: observe ? "观察窗口重点复评振动趋势、相位变化和基础振动是否继续抬升，到期后由 Agent 提醒复核。" : "误报反馈会进入模型反馈池，用于解释阈值、样本标签和规则触发边界，不生成处置票卡。" },
          { key: "record-agent", q: "后续 Agent 会如何引用？", a: "后续 Agent 可引用该归档记录解释为什么当时未进入维修路径，但不会把它作为 P-2 相似维修处置案例。" },
        ],
      };
    }
    if (part.id === DATA.caseKnowledge.partId) {
      return caseKnowledgeBlock(DATA.caseKnowledge.firstPass, "", DATA.caseKnowledge.title);
    }
    return {
      context: "current",
      mode: part.short + "诊断中",
      summary: part.agent,
      sources: DATA.knowledgeHits.map(function (hit) {
        return { kind: sourceKind(hit.type), text: hit.type + " · " + hit.title };
      }),
      questions: [
        { key: "why", q: "为什么优先关注这个部位？", a: part.summary + " 当前证据为：" + part.evidence.join("；") + "。" },
        { key: "points", q: "哪些测点支持这个判断？", a: "主要依据 " + part.checkItem + "，当前趋势为“" + part.trend.alert + "”，现场证据为“" + part.vision.finding + "”。" },
        { key: "recheck", q: "现场复核应该看什么？", a: agentRecheckText(part) },
        { key: "verdict", q: "不同专家结论如何闭环？", a: agentVerdictText() },
      ],
    };
  }

  function caseKnowledgeBlock(block, caseId, title) {
    return {
      context: caseId ? "case" : "current",
      mode: block.label,
      caseId: caseId,
      caseTitle: title || "",
      summary: block.summary,
      sources: block.sources.map(function (source) {
        return { kind: agentSourceKind(source.type), text: source.text };
      }),
      questions: block.questions.map(function (item, index) {
        return { key: item.key || (caseId ? "case" : "first") + "-" + index, q: item.q, a: item.a };
      }),
      facts: block.facts || [],
    };
  }

  function agentSourceKind(type) {
    if (type === "current") return "current";
    if (type === "standard") return "rule";
    if (type === "archive") return "report";
    if (type === "case") return "case";
    return "workcard";
  }

  function agentDrawerTitle() {
    if (state.agentContext === "case") return "历史案例增强诊断";
    if (state.agentContext === "record") return "归档记录问答";
    return "当前异常智能诊断";
  }

  function sourceKind(type) {
    if (type === "作业卡") return "workcard";
    if (type === "专家规则") return "rule";
    if (type === "历史案例") return "case";
    return "report";
  }

  function agentRecheckText(part) {
    if (part.id === "coupling") return "先复核联轴器对中状态、两侧相位和激光对中读数，同时检查地脚螺栓、底座垫片和管道约束。";
    if (part.id === "front-bearing") return "重点复核泵驱动端轴承垂直振动、轴承座温升、润滑状态，并与联轴器相位差联判。";
    if (part.id === "base") return "重点补拍地脚螺栓、垫片和底座接触面，确认基础振动是否放大轴系异常。";
    return "该部位当前更像对照或排除项，复核时记录趋势、照片和人工观察结论即可。";
  }

  function agentVerdictText() {
    if (state.expertVerdict === "确认不对中") return "选择“确认不对中”后生成处置票卡，完成激光对中复测并归档为维修案例，后续 P-2 可命中该案例。";
    if (state.expertVerdict === "继续观察") return "选择“继续观察”后生成观察记录，归档为复评样本，不触发 P-2 维修案例命中。";
    if (state.expertVerdict === "排除误报") return "选择“排除误报”后生成误报反馈，归档为模型反馈样本，不触发维修处置票卡。";
    return "当前尚未选择专家结论。建议先查看时序、视觉/数据和知识规范，再在专家复核页选择确认不对中、继续观察或排除误报。";
  }

  function agentAnswerText(knowledge) {
    var match = knowledge.questions.find(function (item) { return item.key === state.agentQuestion; });
    if (match) return match.a;
    if (knowledge.context === "case") return "已命中 " + knowledge.caseId + "。请选择问题查看历史案例如何增强本次异常处置建议。";
    if (knowledge.context === "record") return "已打开 " + knowledge.caseId + "。请选择问题查看该归档记录如何解释本轮非维修闭环。";
    return "请选择问题查看 Agent 对当前部位、模型证据和闭环路径的解释。";
  }

  function renderFlowStrip() {
    var unlocked = 0;
    if (state.scene === "workbench") unlocked = Math.max(unlocked, 4);
    if (state.expertVerdict) unlocked = Math.max(unlocked, 5);
    if (state.treatmentDone || state.observationDone) unlocked = Math.max(unlocked, 6);
    if (state.scene === "archive") unlocked = Math.max(unlocked, 7);
    if (state.archived) unlocked = state.expertVerdict === "确认不对中" ? DATA.flowSteps.length - 1 : 7;
    return h("div", { class: "flow-strip", "aria-label": "演示流程" }, flowStepsForVerdict().map(function (step, index) {
      return h("div", { class: "flow-step " + (index <= unlocked ? "done" : "") }, [
        h("span", { text: String(index + 1) }),
        h("strong", { text: step.label }),
      ]);
    }));
  }

  function flowStepsForVerdict() {
    if (!isNonMaintenanceVerdict(state.expertVerdict)) return DATA.flowSteps;
    return DATA.flowSteps.map(function (step) {
      if (step.key === "treatment") return { key: step.key, label: "结论闭环" };
      if (step.key === "archive") return { key: step.key, label: "结论归档" };
      if (step.key === "reuse") return { key: step.key, label: "不触发命中" };
      return step;
    });
  }

  function miniChart(trend, size) {
    var width = size === "large" ? 680 : 320;
    var height = size === "large" ? 260 : 130;
    var values = trend.points.map(function (point) { return Number(point[1]); });
    var min = Math.min.apply(null, values.concat([trend.threshold || values[0]]));
    var max = Math.max.apply(null, values.concat([trend.threshold || values[0], trend.stop || values[0]]));
    var range = max - min || 1;
    var points = values.map(function (value, index) {
      var x = 32 + index * ((width - 64) / (values.length - 1));
      var y = height - 28 - ((value - min) / range) * (height - 56);
      return [x, y];
    });
    var thresholdY = height - 28 - ((trend.threshold - min) / range) * (height - 56);
    var polyline = points.map(function (point) { return point[0] + "," + point[1]; }).join(" ");
    return h("svg", { class: "chart " + size, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": trend.title }, [
      h("line", { x1: 28, y1: thresholdY, x2: width - 28, y2: thresholdY, class: "threshold" }),
      h("polyline", { points: polyline, class: "trend-line" }),
      h("g", {}, points.map(function (point) {
        return h("circle", { cx: point[0], cy: point[1], r: 4 });
      })),
      h("text", { x: 30, y: 22, class: "chart-title", text: trend.title }),
      h("text", { x: width - 150, y: thresholdY - 6, class: "chart-threshold", text: "关注线 " + trend.threshold + trend.unit }),
    ]);
  }

  function unitClass(status) {
    if (status === "异常") return "danger";
    if (status === "待复核") return "warn";
    return "ok";
  }

  function bindStage() {
    stage.querySelectorAll("[data-scene]").forEach(function (button) {
      button.addEventListener("click", function () { setScene(button.dataset.scene); });
    });
    stage.querySelectorAll("[data-unit]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedUnit = button.dataset.unit;
        saveState();
        render();
      });
    });
    stage.querySelectorAll("[data-part]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedPart = button.dataset.part;
        state.agentQuestion = "";
        saveState();
        render();
      });
    });
    stage.querySelectorAll("[data-verdict]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.expertVerdict = button.dataset.verdict;
        state.treatmentDone = false;
        state.observationDone = false;
        state.archived = false;
        state.agentContext = "current";
        state.agentQuestion = "";
        saveState();
        render();
      });
    });
    stage.querySelectorAll("[data-agent-context]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.agentContext === "case" && !canUseCaseAgentContextForState(state)) return;
        if (button.dataset.agentContext === "record" && !canUseRecordAgentContextForState(state)) return;
        state.agentContext = ["case", "record"].indexOf(button.dataset.agentContext) >= 0 ? button.dataset.agentContext : "current";
        state.agentQuestion = "";
        saveState();
        render();
        focusAgentContext(state.agentContext);
      });
    });
    stage.querySelectorAll("[data-agent-question]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.agentQuestion = button.dataset.agentQuestion;
        saveState();
        render();
        focusAgentQuestion(state.agentQuestion);
      });
    });
    stage.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () { handleAction(button.dataset.action); });
    });
  }

  function handleAction(action) {
    if (action === "reset-demo") return resetState();
    if (action === "go-workbench") return setScene("workbench");
    if (action === "go-confirm") return setScene("confirm");
    if (action === "go-treatment") return setScene("treatment");
    if (action === "go-archive") return setScene("archive");
    if (action === "confirm-treatment") {
      state.treatmentDone = true;
      state.observationDone = false;
      saveState();
      render();
      return;
    }
    if (action === "confirm-observation") {
      state.observationDone = true;
      state.treatmentDone = false;
      saveState();
      render();
      return;
    }
    if (action === "archive-report") {
      if (!state.treatmentDone && !state.observationDone) return;
      state.archived = true;
      saveState();
      render();
      return;
    }
    if (action === "open-agent-detail") {
      if (state.scene !== "archive") state.scene = "workbench";
      state.agentOpen = true;
      state.agentContext = "current";
      state.agentQuestion = "";
      saveState();
      render();
      focusAgentDrawer();
      return;
    }
    if (action === "open-agent-case") {
      if (!canUseCaseAgentContextForState(state)) return;
      state.agentOpen = true;
      state.agentContext = "case";
      state.agentQuestion = "";
      saveState();
      render();
      focusAgentDrawer();
      return;
    }
    if (action === "open-agent-record") {
      if (!canUseRecordAgentContextForState(state)) return;
      state.agentOpen = true;
      state.agentContext = "record";
      state.agentQuestion = "";
      saveState();
      render();
      focusAgentDrawer();
      return;
    }
    if (action === "close-agent-drawer") {
      state.agentOpen = false;
      state.agentQuestion = "";
      saveState();
      render();
      stage.focus();
      return;
    }
    if ((action === "open-trend-detail" || action === "open-vision-detail") && state.scene !== "workbench") {
      state.scene = "workbench";
    }
    var resetView = action === "open-trend-detail" || action === "open-vision-detail" || action === "close-detail";
    if (action === "open-trend-detail") state.detail = "trend";
    if (action === "open-vision-detail") state.detail = "vision";
    if (action === "close-detail") state.detail = "";
    saveState();
    render();
    if (resetView) {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
      window.setTimeout(resetScroll, 0);
    }
  }

  function focusAgentDrawer() {
    var drawer = stage.querySelector(".agent-drawer");
    if (drawer) drawer.focus();
  }

  function focusAgentContext(context) {
    var button = stage.querySelector("[data-agent-context='" + context + "']");
    if (button) button.focus();
    else focusAgentDrawer();
  }

  function focusAgentQuestion(question) {
    var button = stage.querySelector("[data-agent-question='" + question + "']");
    if (button) button.focus();
    else focusAgentDrawer();
  }

  function focusableAgentControls() {
    var drawer = stage.querySelector(".agent-drawer");
    if (!drawer) return [];
    return Array.prototype.slice.call(drawer.querySelectorAll("button:not([disabled])"));
  }

  document.addEventListener("keydown", function (event) {
    if (!state.agentOpen) return;
    if (event.key === "Escape") {
      state.agentOpen = false;
      state.agentQuestion = "";
      saveState();
      render();
      stage.focus();
      return;
    }
    if (event.key !== "Tab") return;
    var controls = focusableAgentControls();
    if (!controls.length) {
      event.preventDefault();
      focusAgentDrawer();
      return;
    }
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (controls.indexOf(document.activeElement) < 0) {
      event.preventDefault();
      first.focus();
    }
  });

  document.querySelectorAll("[data-action='reset-demo']").forEach(function (button) {
    button.addEventListener("click", resetState);
  });

  render();
})();
