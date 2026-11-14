import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiKey,
  FiMonitor,
  FiMoon,
  FiPlay,
  FiPower,
  FiRefreshCw,
  FiRotateCw,
  FiSun,
  FiTrash2,
  FiWifi,
  FiWifiOff,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import "./Scheduler.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const EMPTY_SUMMARY = {
  totalDisplays: 0,
  onlineDisplays: 0,
  sleepingOfflineDisplays: 0,
  scheduledToSleepToday: 0,
  scheduledToWakeToday: 0,
};

const CATEGORY_LABELS = {
  environmental: "Environmental",
  social: "Social",
  governance: "Governance",
};

const DAY_OPTIONS = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }
  const data = await response.json();
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  return parseApiResponse(response);
}

function formatRelative(value) {
  if (!value) return "Never connected";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Never connected";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasValidMac(value) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(String(value || ""));
}

function commandLabel(commandType) {
  return String(commandType || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayState(monitor) {
  const command = monitor.latest_command;
  if (monitor.status === "online") return "online";
  if (command?.command_type === "wake_pc" && command.status === "waiting_for_reconnect") {
    return "waking";
  }
  if (command?.command_type === "sleep_pc" && ["sent", "acknowledged", "completed"].includes(command.status)) {
    return "sleeping";
  }
  return "offline";
}

function daysText(days = []) {
  if (!days.length) return "No days";
  const set = new Set(days);
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const weekend = ["saturday", "sunday"];
  if (DAY_OPTIONS.every(([day]) => set.has(day))) return "Every day";
  if (weekdays.every((day) => set.has(day)) && days.length === 5) return "Mon–Fri";
  if (weekend.every((day) => set.has(day)) && days.length === 2) return "Sat–Sun";
  return days
    .map((day) => DAY_OPTIONS.find(([value]) => value === day)?.[1] || day)
    .join(", ");
}

function Modal({ title, subtitle, children, onClose, className = "" }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="scheduler-modal-overlay" onMouseDown={onClose}>
      <section
        className={`scheduler-modal ${className}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="scheduler-modal__header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <FiX />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Scheduler() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [monitors, setMonitors] = useState([]);
  const [powerSchedules, setPowerSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleModal, setScheduleModal] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    monitorId: "",
    isEnabled: true,
    sleepTime: "19:00",
    wakeTime: "08:30",
    repeatDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    notes: "",
  });

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [summaryData, monitorData, scheduleData] = await Promise.all([
        apiRequest("/api/admin/power-scheduler/summary"),
        apiRequest("/api/admin/power-scheduler/monitors"),
        apiRequest("/api/admin/power-schedules"),
      ]);
      setSummary(summaryData.summary || EMPTY_SUMMARY);
      setMonitors(monitorData.monitors || []);
      setPowerSchedules(scheduleData.schedules || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load the Display Power Scheduler.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    let refreshTimer;
    const refreshSoon = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadData({ quiet: true }), 350);
    };
    socket.on("monitor-status-updated", refreshSoon);
    socket.on("command-status-updated", refreshSoon);
    socket.on("scheduler-data-updated", refreshSoon);
    return () => {
      window.clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const monitorGroups = useMemo(() => {
    return ["environmental", "social", "governance"].map((category) => ({
      category,
      monitors: monitors.filter((monitor) => monitor.monitor_category === category),
    }));
  }, [monitors]);

  const openScheduleModal = (monitor, schedule) => {
    const existingSchedule = schedule || monitor?.power_schedule;
    const scheduleMonitor = monitor || (existingSchedule ? {
      monitor_id: existingSchedule.monitor_id,
      monitor_name: existingSchedule.monitor_name || `Display ${existingSchedule.monitor_id}`,
      monitor_category: existingSchedule.monitor_category || "",
    } : null);

    if (!scheduleMonitor?.monitor_id) {
      setError("Unable to find the display for this power schedule. Refresh and try again.");
      return;
    }

    setScheduleModal({ monitor: scheduleMonitor, schedule: existingSchedule });
    setScheduleForm({
      monitorId: String(scheduleMonitor.monitor_id),
      isEnabled: existingSchedule ? Boolean(existingSchedule.is_enabled) : true,
      sleepTime: existingSchedule?.sleep_time || "19:00",
      wakeTime: existingSchedule?.wake_time || "08:30",
      repeatDays: existingSchedule?.repeat_days?.length
        ? existingSchedule.repeat_days
        : ["monday", "tuesday", "wednesday", "thursday", "friday"],
      notes: existingSchedule?.notes || "",
    });
  };

  const toggleRepeatDay = (day) => {
    setScheduleForm((current) => {
      const hasDay = current.repeatDays.includes(day);
      return {
        ...current,
        repeatDays: hasDay
          ? current.repeatDays.filter((item) => item !== day)
          : [...current.repeatDays, day],
      };
    });
  };

  const submitPowerSchedule = async (event) => {
    event.preventDefault();
    if (!scheduleModal) return;
    if (scheduleForm.repeatDays.length === 0) {
      setError("Choose at least one repeat day.");
      return;
    }
    if (scheduleForm.sleepTime === scheduleForm.wakeTime) {
      setError("Sleep time and wake time cannot be the same.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({
        monitorId: Number(scheduleForm.monitorId),
        isEnabled: scheduleForm.isEnabled,
        sleepTime: scheduleForm.sleepTime,
        wakeTime: scheduleForm.wakeTime,
        repeatDays: scheduleForm.repeatDays,
        notes: scheduleForm.notes,
      });
      const path = scheduleModal.schedule
        ? `/api/admin/power-schedules/${scheduleModal.schedule.power_schedule_id}`
        : "/api/admin/power-schedules";
      const method = scheduleModal.schedule ? "PUT" : "POST";
      const data = await apiRequest(path, { method, body });
      setNotice(data.message || "Power schedule saved.");
      setScheduleModal(null);
      await loadData({ quiet: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to save the power schedule.");
    } finally {
      setSaving(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest(action.path, {
        method: action.method || "POST",
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      setNotice(data.message || "Action completed.");
      setConfirmAction(null);
      await loadData({ quiet: true });
    } catch (requestError) {
      setError(requestError.message || "The action could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  const confirmCommand = (monitor, type) => {
    const labels = {
      sleep: {
        title: "Put display PC to sleep?",
        message: `${monitor.monitor_name} will go offline. It can only wake automatically when Wake-on-WLAN is supported or by its next local wake method.`,
        confirmLabel: "Sleep Now",
        path: `/api/admin/monitors/${monitor.monitor_id}/sleep-now`,
        icon: <FiMoon />,
      },
      wake: {
        title: "Wake display PC?",
        message: `A Wake-on-WLAN packet will be sent to ${monitor.monitor_name}. Success is confirmed only when the heartbeat returns.`,
        confirmLabel: "Wake Now",
        path: `/api/admin/monitors/${monitor.monitor_id}/wake-now`,
        icon: <FiSun />,
      },
      launch: {
        title: "Launch display?",
        message: `Chrome kiosk mode will open on ${monitor.monitor_name} and play its assigned playlist.`,
        confirmLabel: "Launch",
        path: `/api/admin/monitors/${monitor.monitor_id}/launch`,
        icon: <FiPlay />,
      },
      restart: {
        title: "Restart kiosk browser?",
        message: `Only the Chrome kiosk process started by the Display Agent will be restarted.`,
        confirmLabel: "Restart Browser",
        path: `/api/admin/monitors/${monitor.monitor_id}/restart-browser`,
        icon: <FiRotateCw />,
      },
      reset: {
        title: monitor.is_paired ? "Reset pairing?" : "Generate pairing code?",
        message: monitor.is_paired
          ? `${monitor.monitor_name} will disconnect from its current Display Agent and receive a new one-time pairing code.`
          : `Generate a fresh one-time pairing code for ${monitor.monitor_name}.`,
        confirmLabel: monitor.is_paired ? "Reset Pairing" : "Generate Code",
        path: `/api/admin/monitors/${monitor.monitor_id}/reset-pairing`,
        danger: monitor.is_paired,
        icon: <FiKey />,
      },
    };
    setConfirmAction(labels[type]);
  };

  const confirmBulkCommand = (type) => {
    const labels = {
      sleepAll: {
        title: "Sleep all display PCs?",
        message:
          "Sleep All will send the sleep command to every online paired Display Agent. Offline or unpaired PCs will be skipped and reported by the backend.",
        confirmLabel: "Sleep All PCs",
        path: "/api/admin/monitors/sleep-all",
        icon: <FiMoon />,
      },
      wakeAll: {
        title: "Wake all display PCs?",
        message:
          "Wake All will send Wake-on-WLAN packets to paired display PCs with stored Wi-Fi MAC addresses. Success is confirmed only when each PC heartbeat returns.",
        confirmLabel: "Wake All PCs",
        path: "/api/admin/monitors/wake-all",
        icon: <FiSun />,
      },
    };
    setConfirmAction(labels[type]);
  };

  const toggleScheduleEnabled = (schedule) => {
    setConfirmAction({
      title: schedule.is_enabled ? "Disable power schedule?" : "Enable power schedule?",
      message: `${schedule.monitor_name} will ${schedule.is_enabled ? "stop" : "start"} following its saved sleep/wake timings.`,
      confirmLabel: schedule.is_enabled ? "Disable" : "Enable",
      path: `/api/admin/power-schedules/${schedule.power_schedule_id}`,
      method: "PUT",
      body: {
        monitorId: schedule.monitor_id,
        isEnabled: !schedule.is_enabled,
        sleepTime: schedule.sleep_time,
        wakeTime: schedule.wake_time,
        repeatDays: schedule.repeat_days,
        notes: schedule.notes || "",
      },
    });
  };

  const deleteSchedule = (schedule) => {
    setConfirmAction({
      title: "Delete power schedule?",
      message: `The saved sleep/wake schedule for ${schedule.monitor_name} will be permanently removed.`,
      confirmLabel: "Delete Schedule",
      path: `/api/admin/power-schedules/${schedule.power_schedule_id}`,
      method: "DELETE",
      danger: true,
      icon: <FiTrash2 />,
    });
  };

  if (loading) {
    return (
      <main className="scheduler-page scheduler-loading-state">
        <FiRefreshCw className="scheduler-spin" />
        <p>Loading display power schedules…</p>
      </main>
    );
  }

  return (
    <main className="scheduler-page">
      <header className="scheduler-hero">
        <div>
          <span className="scheduler-eyebrow">Control room</span>
          <h1>Display Power Scheduler</h1>
          <p>Schedule display PC sleep and wake times, and monitor connected display agents.</p>
          <small>Times are Singapore local time. Wake-on-WLAN is experimental and is confirmed only after heartbeat resumes.</small>
        </div>
        <div className="scheduler-hero-actions">
          <button type="button" className="scheduler-button scheduler-button--secondary" onClick={() => confirmBulkCommand("sleepAll")} disabled={saving || monitors.length === 0}>
            <FiMoon />
            Sleep All PCs
          </button>
          <button type="button" className="scheduler-button scheduler-button--secondary scheduler-button--wake" onClick={() => confirmBulkCommand("wakeAll")} disabled={saving || monitors.length === 0}>
            <FiSun />
            Wake All PCs
          </button>
          <button type="button" className="scheduler-button scheduler-button--primary" onClick={() => loadData({ quiet: true })} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? "scheduler-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="scheduler-alert scheduler-alert--error" role="alert">
          <FiXCircle />
          <div>
            <strong>Power Scheduler request failed</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><FiX /></button>
        </div>
      )}

      {notice && (
        <div className="scheduler-alert scheduler-alert--success" role="status">
          <FiCheckCircle />
          <span>{notice}</span>
        </div>
      )}

      <section className="scheduler-summary-grid" aria-label="Power schedule summary">
        {[
          ["Total Displays", summary.totalDisplays, <FiMonitor />],
          ["Online Displays", summary.onlineDisplays, <FiWifi />],
          ["Sleeping / Offline", summary.sleepingOfflineDisplays, <FiWifiOff />],
          ["Sleep Scheduled Today", summary.scheduledToSleepToday, <FiMoon />],
          ["Wake Scheduled Today", summary.scheduledToWakeToday, <FiSun />],
        ].map(([label, value, icon]) => (
          <article className="scheduler-summary-card" key={label}>
            <div>{icon}</div>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="scheduler-section">
        <div className="scheduler-section-heading">
          <div>
            <span>Live overview</span>
            <h2>Display PCs</h2>
          </div>
          <p>After wake, the agent reconnects, opens kiosk Chrome, and plays the assigned playlist/current display content.</p>
        </div>

        {monitorGroups.map((group) => (
          <div className="scheduler-category" key={group.category}>
            <div className="scheduler-category__heading">
              <h3>{CATEGORY_LABELS[group.category]}</h3>
              <span>{group.monitors.length} displays</span>
            </div>
            {group.monitors.length === 0 ? (
              <div className="scheduler-empty-inline">No {CATEGORY_LABELS[group.category].toLowerCase()} displays found.</div>
            ) : (
              <div className="scheduler-display-grid">
                {group.monitors.map((monitor) => {
                  const state = displayState(monitor);
                  const online = monitor.status === "online";
                  const canWake = Boolean(monitor.is_paired && hasValidMac(monitor.mac_address));
                  const schedule = monitor.power_schedule;
                  return (
                    <article className={`scheduler-display-card scheduler-display-card--${state}`} key={monitor.monitor_id}>
                      <div className="scheduler-display-card__top">
                        <div className="scheduler-display-icon"><FiMonitor /></div>
                        <div>
                          <h3>{monitor.monitor_name}</h3>
                          <p>{CATEGORY_LABELS[monitor.monitor_category]} Display</p>
                        </div>
                        <span className={`scheduler-state scheduler-state--${state}`}>{state}</span>
                      </div>

                      <div className="scheduler-card-grid">
                        <div><span>Pairing</span><strong>{monitor.is_paired ? "Paired" : "Unpaired"}</strong></div>
                        <div><span>Pairing code</span><strong>{monitor.pairing_code || "Not generated"}</strong></div>
                        <div><span>PC hostname</span><strong>{monitor.device_hostname || "Not reported"}</strong></div>
                        <div><span>Last IP</span><strong>{monitor.last_ip_address || "Not reported"}</strong></div>
                        <div><span>Wi-Fi MAC</span><strong>{monitor.mac_address || "Not reported"}</strong></div>
                        <div><span>Browser</span><strong>{monitor.browser_status || "unknown"}</strong></div>
                        <div><span>Last heartbeat</span><strong>{formatRelative(monitor.last_heartbeat_at_iso)}</strong></div>
                        <div><span>Wake-on-WLAN</span><strong>{monitor.wake_on_wlan_enabled ? "Confirmed" : "Experimental"}</strong></div>
                      </div>

                      <div className="scheduler-card-block">
                        <span>Assigned playlist / content</span>
                        <strong>{monitor.current_project_name || "No assigned playlist"}</strong>
                      </div>

                      <div className="scheduler-card-block scheduler-card-block--schedule">
                        <span>Power schedule</span>
                        {schedule ? (
                          <strong>
                            {schedule.is_enabled ? "Enabled" : "Disabled"} · Sleep {schedule.sleep_time} · Wake {schedule.wake_time} · {daysText(schedule.repeat_days)}
                          </strong>
                        ) : (
                          <strong>No sleep/wake schedule</strong>
                        )}
                      </div>

                      {monitor.latest_command && (
                        <div className={`scheduler-command scheduler-command--${monitor.latest_command.status}`}>
                          <FiClock />
                          <div>
                            <strong>{commandLabel(monitor.latest_command.command_type)} · {monitor.latest_command.status}</strong>
                            <span>{monitor.latest_command.message || "No details"}</span>
                          </div>
                        </div>
                      )}

                      <div className="scheduler-actions-row scheduler-actions-row--wide">
                        <button type="button" className="scheduler-button scheduler-button--primary" onClick={() => openScheduleModal(monitor)}>
                          <FiClock /> Set Sleep/Wake Schedule
                        </button>
                        <button type="button" className="scheduler-button scheduler-button--secondary" onClick={() => confirmCommand(monitor, "reset")}>
                          <FiKey /> Reset Pairing
                        </button>
                      </div>
                      <div className="scheduler-actions-row">
                        <button type="button" title={online ? "Put PC to sleep now" : "Agent must be online to sleep"} disabled={!online} onClick={() => confirmCommand(monitor, "sleep")}>
                          <FiMoon /> Sleep
                        </button>
                        <button type="button" title={canWake ? "Send experimental Wake-on-WLAN packet" : "Requires paired monitor and valid MAC"} disabled={!canWake} onClick={() => confirmCommand(monitor, "wake")}>
                          <FiSun /> Wake
                        </button>
                        <button type="button" disabled={!online} onClick={() => confirmCommand(monitor, "launch")}>
                          <FiPlay /> Launch
                        </button>
                        <button type="button" disabled={!online} onClick={() => confirmCommand(monitor, "restart")}>
                          <FiRotateCw /> Restart
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="scheduler-section">
        <div className="scheduler-section-heading">
          <div>
            <span>Automation</span>
            <h2>Power schedule table</h2>
          </div>
          <p>Schedules repeat weekly and are checked by the backend every 30 seconds.</p>
        </div>

        <div className="scheduler-table-wrap">
          <table className="scheduler-table">
            <thead>
              <tr>
                <th>Display</th>
                <th>Category</th>
                <th>Sleep Time</th>
                <th>Wake Time</th>
                <th>Repeat Days</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {powerSchedules.map((schedule) => (
                <tr key={schedule.power_schedule_id}>
                  <td><strong>{schedule.monitor_name}</strong></td>
                  <td><span className={`scheduler-category-pill scheduler-category-pill--${schedule.monitor_category}`}>{CATEGORY_LABELS[schedule.monitor_category]}</span></td>
                  <td>{schedule.sleep_time}</td>
                  <td>{schedule.wake_time}</td>
                  <td>{daysText(schedule.repeat_days)}</td>
                  <td><span className={`scheduler-schedule-status scheduler-schedule-status--${schedule.is_enabled ? "active" : "cancelled"}`}>{schedule.is_enabled ? "Enabled" : "Disabled"}</span></td>
                  <td>
                    <div className="scheduler-table-actions">
                        <button type="button" onClick={() => openScheduleModal(monitors.find((item) => Number(item.monitor_id) === Number(schedule.monitor_id)), schedule)} aria-label={`Edit ${schedule.monitor_name} power schedule`}><FiEdit2 /></button>
                      <button type="button" onClick={() => toggleScheduleEnabled(schedule)} aria-label={`${schedule.is_enabled ? "Disable" : "Enable"} ${schedule.monitor_name} power schedule`}><FiPower /></button>
                      <button type="button" onClick={() => deleteSchedule(schedule)} aria-label={`Delete ${schedule.monitor_name} power schedule`}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {powerSchedules.length === 0 && (
                <tr>
                  <td colSpan="7" className="scheduler-table-empty">
                    <FiClock />
                    <strong>No power schedules yet.</strong>
                    <span>Use Set Sleep/Wake Schedule on a display card to add one.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {scheduleModal && (
        <Modal
          title={scheduleModal.schedule ? "Edit sleep/wake schedule" : "Set sleep/wake schedule"}
          subtitle={`${scheduleModal.monitor.monitor_name} · ${CATEGORY_LABELS[scheduleModal.monitor.monitor_category] || "Display"}`}
          onClose={() => !saving && setScheduleModal(null)}
          className="scheduler-modal--form"
        >
          <form onSubmit={submitPowerSchedule} className="scheduler-form">
            <label className="scheduler-checkline">
              <input type="checkbox" checked={scheduleForm.isEnabled} onChange={(event) => setScheduleForm({ ...scheduleForm, isEnabled: event.target.checked })} />
              <span>Enable this sleep/wake schedule</span>
            </label>
            <div className="scheduler-form-grid">
              <label>
                <span>Sleep time</span>
                <input required type="time" value={scheduleForm.sleepTime} onChange={(event) => setScheduleForm({ ...scheduleForm, sleepTime: event.target.value })} />
              </label>
              <label>
                <span>Wake time</span>
                <input required type="time" value={scheduleForm.wakeTime} onChange={(event) => setScheduleForm({ ...scheduleForm, wakeTime: event.target.value })} />
              </label>
            </div>
            <fieldset className="scheduler-days-fieldset">
              <legend>Repeat days</legend>
              <div className="scheduler-day-buttons">
                {DAY_OPTIONS.map(([day, label]) => (
                  <button
                    type="button"
                    key={day}
                    className={scheduleForm.repeatDays.includes(day) ? "is-selected" : ""}
                    onClick={() => toggleRepeatDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span>Notes (optional)</span>
              <textarea maxLength="500" rows="3" value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} placeholder="Example: Weekday opening hours for ESG Centre" />
            </label>
            <div className="scheduler-modal-actions">
              <button type="button" className="scheduler-button scheduler-button--secondary" onClick={() => setScheduleModal(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="scheduler-button scheduler-button--primary" disabled={saving}>{saving ? "Saving…" : "Save Schedule"}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && (
        <Modal
          title={confirmAction.title}
          subtitle={confirmAction.danger ? "Review this action carefully." : "Confirm display PC action."}
          onClose={() => !saving && setConfirmAction(null)}
          className="scheduler-modal--confirm"
        >
          <div className="scheduler-confirm-message">
            {confirmAction.icon || (confirmAction.danger ? <FiPower /> : <FiMonitor />)}
            <p>{confirmAction.message}</p>
          </div>
          <div className="scheduler-modal-actions">
            <button type="button" className="scheduler-button scheduler-button--secondary" onClick={() => setConfirmAction(null)} disabled={saving}>Cancel</button>
            <button type="button" className={`scheduler-button ${confirmAction.danger ? "scheduler-button--danger" : "scheduler-button--primary"}`} onClick={runConfirmedAction} disabled={saving}>{saving ? "Working…" : confirmAction.confirmLabel}</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default Scheduler;
