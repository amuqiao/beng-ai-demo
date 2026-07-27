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
      expertVerdict: "",
      treatmentDone: false,
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
    if (["trend", "vision", "agent", ""].indexOf(clean.detail) < 0) clean.detail = "";
    clean.expertVerdict = typeof clean.expertVerdict === "string" ? clean.expertVerdict : "";
    clean.treatmentDone = clean.treatmentDone === true && clean.expertVerdict === "确认不对中";
    clean.archived = clean.archived === true && clean.treatmentDone;
    return clean;
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
    if (sceneKey === "overview" || sceneKey === "workbench") return true;
    if (sceneKey === "confirm") return true;
    if (sceneKey === "treatment") return state.expertVerdict === "确认不对中" || state.treatmentDone || state.archived;
    if (sceneKey === "archive") return state.treatmentDone || state.archived;
    return false;
  }

  function setScene(sceneKey) {
    if (sceneOrder.indexOf(sceneKey) < 0 || !canOpen(sceneKey)) return;
    state.scene = sceneKey;
    if (sceneKey !== "workbench") state.detail = "";
    saveState();
    render();
    stage.focus();
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
    bindStage();
  }

  function currentStatusLine() {
    if (state.archived) return "P-1 案例已归档，P-2 二次相似命中已解锁。";
    if (state.treatmentDone) return "处置票卡和复测证据已确认，可生成归档报告。";
    if (state.expertVerdict === "确认不对中") return "专家已确认疑似不对中，待执行处置票卡和复测确认。";
    if (state.expertVerdict) return "专家已选择非闭环结论，当前不生成维修案例归档。";
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
      statusPill("处置复测", state.treatmentDone),
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
    return pageShell(
      "任务总览 / 轴系部位",
      "P-1 输油泵机组部位态势大屏",
      h("button", { type: "button", class: "primary-action", dataset: { action: "go-workbench" }, text: "进入诊断工作台" }),
      h("div", { class: "overview-grid" }, [
        h("section", { class: "panel task-panel" }, [
          panelTitle("本轮诊断对象", DATA.task.batch),
          h("h3", { text: DATA.task.title }),
          h("p", { class: "muted", text: DATA.task.note }),
          h("div", { class: "task-rows" }, DATA.task.rows.map(function (row) {
            return h("div", {}, [h("span", { text: row[0] }), h("strong", { text: row[1] })]);
          })),
          h("div", { class: "metric-grid" }, DATA.task.metrics.map(function (metric) {
            return h("div", { class: "metric-card" }, [
              h("span", { text: metric.label }),
              h("strong", { text: metric.value }),
              h("small", { text: metric.unit }),
            ]);
          })),
          h("div", { class: "unit-list" }, DATA.pumpUnits.map(function (unit) {
            return h("button", {
              type: "button",
              disabled: unit.id !== "P-1",
              class: "unit-card " + (unit.id === state.selectedUnit ? "active " : "") + unitClass(unit.status) + (unit.id !== "P-1" ? " readonly" : ""),
              dataset: unit.id === "P-1" ? { unit: unit.id } : {},
            }, [
              h("strong", { text: unit.name }),
              h("span", { text: unit.id === "P-1" ? unit.status : "对比样本" }),
              h("small", { text: "负荷 " + unit.load + " · 振动 " + unit.vibration + " · 温度 " + unit.temp }),
            ]);
          })),
        ]),
        h("section", { class: "panel train-panel" }, [
          panelTitle("P-1 机组部位总览", "pump train"),
          renderPumpTrain(part.id),
          h("div", { class: "train-legend" }, [
            legend("danger", "异常部位"),
            legend("warn", "关注部位"),
            legend("ok", "对照部位"),
          ]),
        ]),
        h("aside", { class: "panel event-panel" }, [
          panelTitle("当前事件", "AI event"),
          h("div", { class: "event-code" }, [
            h("strong", { text: "EVT-CL-P1-ALIGN-0722" }),
            h("span", { class: "badge " + part.status, text: part.badge }),
          ]),
          h("h3", { text: part.label + " · " + part.component }),
          h("p", { class: "event-summary", text: part.summary }),
          h("div", { class: "evidence-list" }, part.evidence.map(function (item) {
            return h("div", {}, [h("span", { class: "dot " + part.status }), h("span", { text: item })]);
          })),
          h("div", { class: "right-actions" }, [
            h("button", { type: "button", class: "primary-action", dataset: { action: "go-workbench" }, text: "查看模型证据" }),
            h("button", { type: "button", class: "plain-button", dataset: { action: "open-agent-detail" }, text: "询问 Agent" }),
          ]),
        ]),
      ])
    );
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
    return pageShell(
      "诊断工作台 / 模型证据",
      part.label + "证据会聚工作台",
      h("button", { type: "button", class: "primary-action", dataset: { action: "go-confirm" }, text: "提交专家确认" }),
      h("div", { class: "workbench-stack" }, [
        h("div", { class: "workbench-grid" }, [
          renderScopePanel(part),
          renderDiagnosisMatrix(part),
          renderConclusionPanel(part),
        ]),
        renderSignalCards(part),
        renderAssistRow(part),
        state.detail ? renderDetailPanel(part) : null,
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
        panelTitle("视觉模型预警", "vision model"),
        h("img", { class: "thumb", src: mediaSrc(part.vision.src), alt: part.vision.title }),
        h("p", { text: part.vision.finding }),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-vision-detail" }, text: "查看视觉详情" }),
      ]),
      h("section", { class: "panel assist-card" }, [
        panelTitle("Agent 辅助问答", "agent"),
        h("p", { text: part.agent }),
        h("div", { class: "agent-chips" }, [
          h("span", { text: "综合时序" }),
          h("span", { text: "调用作业卡" }),
          h("span", { text: "生成处置建议" }),
        ]),
        h("button", { type: "button", class: "plain-button", dataset: { action: "open-agent-detail" }, text: "打开 Agent 对话" }),
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

  function renderDetailPanel(part) {
    var title = state.detail === "trend" ? "时序详情" : state.detail === "vision" ? "视觉详情" : "Agent 辅助问答";
    return h("section", { class: "panel detail-panel", id: "evidenceDetail" }, [
      h("div", { class: "detail-head" }, [
        h("div", {}, [h("p", { class: "kicker", text: "工作台内展开" }), h("h3", { text: title + " · " + part.label })]),
        h("button", { type: "button", class: "tool-btn", dataset: { action: "close-detail" }, text: "关闭" }),
      ]),
      state.detail === "trend" ? renderTrendDetail(part) : state.detail === "vision" ? renderVisionDetail(part) : renderAgentDetail(part),
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

  function renderAgentDetail(part) {
    return h("div", { class: "agent-thread" }, [
      chat("user", "P-1 为什么优先判断为不对中？"),
      chat("agent", part.agent),
      chat("agent", "证据链包含：" + part.evidence.join("；") + "。建议结合对中作业卡执行复核，完成后回填复测值并归档为相似案例。"),
      h("div", { class: "agent-tools" }, DATA.knowledgeHits.map(function (hit) {
        return h("div", {}, [h("span", { text: hit.type }), h("strong", { text: hit.title }), h("small", { text: hit.source })]);
      })),
    ]);
  }

  function chat(role, text) {
    return h("div", { class: "chat " + role }, [h("span", { text: role === "user" ? "运行工程师" : "Agent" }), h("p", { text: text })]);
  }

  function renderConfirm() {
    var part = selectedPart();
    return pageShell(
      "专家复核 / 知识规范",
      "专家确认与处置票卡",
      h("button", { type: "button", class: "primary-action", disabled: state.expertVerdict !== "确认不对中", dataset: { action: "go-treatment" }, text: "生成处置票卡" }),
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
          h("div", { class: "workorder-box" }, [
            h("h4", { text: DATA.workOrder.title }),
            h("ol", {}, DATA.workOrder.steps.map(function (step) { return h("li", { text: step }); })),
          ]),
        ]),
      ])
    );
  }

  function verdictButton(label) {
    return h("button", {
      type: "button",
      class: "verdict-button " + (state.expertVerdict === label ? "active" : ""),
      dataset: { verdict: label },
    }, [
      h("strong", { text: label }),
      h("span", { text: label === "确认不对中" ? "生成处置票卡并进入复测闭环" : "保留证据但不形成维修闭环" }),
    ]);
  }

  function renderTreatment() {
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

  function renderArchive() {
    return pageShell(
      "报告归档 / 案例复用",
      DATA.report.title,
      h("button", { type: "button", class: "primary-action", disabled: state.archived, dataset: { action: "archive-report" }, text: state.archived ? "已归档" : "确认归档" }),
      h("div", { class: "archive-stack" }, [
        h("div", { class: "archive-grid" }, [
          h("section", { class: "panel report-panel" }, [
            panelTitle("报告草稿", "six sections"),
            DATA.report.sections.map(function (section, index) {
              return h("article", { class: "report-section" }, [
                h("span", { text: String(index + 1).padStart(2, "0") }),
                h("div", {}, [h("h3", { text: section[0] }), h("p", { text: section[1] })]),
              ]);
            }),
          ]),
          h("aside", { class: "panel archive-side" }, [
            panelTitle("归档状态", "case entry"),
            h("div", { class: "case-card " + (state.archived ? "ready" : "") }, [
              h("strong", { text: state.archived ? DATA.reuse.matchedCase : "等待归档确认" }),
              h("p", { text: state.archived ? "已沉淀为相似异常检索案例。" : "处置复测确认后，报告可归档进入案例库。" }),
            ]),
            h("div", { class: "tag-cloud" }, ["不对中", "2X频谱", "相位差异常", "基础振动", "激光对中", "输油泵"].map(function (tag) {
              return h("span", { text: tag });
            })),
          ]),
        ]),
        renderReuseCard(),
      ])
    );
  }

  function renderReuseCard() {
    return h("section", { class: "panel reuse-panel " + (state.archived ? "unlocked" : "locked") }, [
      panelTitle("二次案例命中预览", state.archived ? "P-2 reused" : "locked"),
      h("div", { class: "reuse-grid" }, [
        h("div", {}, [
          h("h3", { text: DATA.reuse.title }),
          h("p", { text: state.archived ? DATA.reuse.agent : "完成 P-1 案例归档后，P-2 相似异常命中才会解锁。" }),
        ]),
        h("div", { class: "reuse-tags" }, DATA.reuse.reasons.map(function (reason) { return h("span", { text: reason }); })),
        h("div", { class: "case-id", text: state.archived ? DATA.reuse.matchedCase : "未解锁" }),
      ]),
    ]);
  }

  function renderFlowStrip() {
    var unlocked = 0;
    if (state.scene === "workbench") unlocked = Math.max(unlocked, 4);
    if (state.expertVerdict) unlocked = Math.max(unlocked, 5);
    if (state.treatmentDone) unlocked = Math.max(unlocked, 6);
    if (state.scene === "archive") unlocked = Math.max(unlocked, 7);
    if (state.archived) unlocked = DATA.flowSteps.length - 1;
    return h("div", { class: "flow-strip", "aria-label": "演示流程" }, DATA.flowSteps.map(function (step, index) {
      return h("div", { class: "flow-step " + (index <= unlocked ? "done" : "") }, [
        h("span", { text: String(index + 1) }),
        h("strong", { text: step.label }),
      ]);
    }));
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
        saveState();
        render();
      });
    });
    stage.querySelectorAll("[data-verdict]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.expertVerdict = button.dataset.verdict;
        state.treatmentDone = false;
        state.archived = false;
        saveState();
        render();
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
      saveState();
      render();
      return;
    }
    if (action === "archive-report") {
      state.archived = true;
      saveState();
      render();
      return;
    }
    if ((action === "open-trend-detail" || action === "open-vision-detail" || action === "open-agent-detail") && state.scene !== "workbench") {
      state.scene = "workbench";
    }
    if (action === "open-trend-detail") state.detail = "trend";
    if (action === "open-vision-detail") state.detail = "vision";
    if (action === "open-agent-detail") state.detail = "agent";
    if (action === "close-detail") state.detail = "";
    saveState();
    render();
    if (state.detail) {
      var detail = document.getElementById("evidenceDetail");
      if (detail) detail.scrollIntoView({ block: "nearest" });
    }
  }

  document.querySelectorAll("[data-action='reset-demo']").forEach(function (button) {
    button.addEventListener("click", resetState);
  });

  render();
})();
