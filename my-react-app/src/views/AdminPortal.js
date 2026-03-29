import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  getTalents, getArcana, getTechniques, getOrigins, getVisions,
} from "../api/characterApi";
import {
  createTalent, updateTalent, deleteTalent,
  createArcana, updateArcana, deleteArcana,
  createTechnique, updateTechnique, deleteTechnique,
  createOrigin, updateOrigin, deleteOrigin,
  createVision, updateVision, deleteVision,
  getUsers, setUserActive,
} from "../api/adminApi";
import PaginatedPickerList from "./wizard/PaginatedPickerList";

const TABS = ["Talents", "Origins", "Visions", "Techniques", "Arcana", "Users"];
const RESOURCE_TABS = ["Talents", "Origins", "Visions", "Techniques", "Arcana"];

const USER_PAGE_SIZE = 8;

function getUserPaginationItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 2, current - 1, current, current + 1, current + 2, "...", total];
}

function UserPagination({ page, total, onPage }) {
  if (total <= 1) return null;
  const items = getUserPaginationItems(page, total);
  return (
    <div className="talent-pagination">
      <button className="pg-btn pg-nav" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>PREV</button>
      {items.map((item, i) =>
        item === "..." ? (
          <span key={`e-${i}`} className="pg-ellipsis">...</span>
        ) : (
          <button key={item} className={`pg-btn pg-num${item === page ? " pg-active" : ""}`} onClick={() => onPage(item)}>{item}</button>
        )
      )}
      <button className="pg-btn pg-nav" onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total}>NEXT</button>
    </div>
  );
}

function UserCard({ user, onToggle, toggling, currentUserId }) {
  const isSelf       = user.userId === currentUserId;
  const isAdminUser  = user.roleName === "Admin";
  const canDeactivate = user.isActive && !isSelf && !isAdminUser;

  let tooltip = null;
  if (user.isActive && isSelf)     tooltip = "You cannot deactivate your own account";
  if (user.isActive && isAdminUser && !isSelf) tooltip = "Admin accounts cannot be deactivated";

  return (
    <div className="admin-user-card">
      <div className="admin-user-info">
        <span className="admin-user-name">{user.username}</span>
        <span className="admin-user-email muted">{user.email}</span>
      </div>
      <button
        className={`btn ${user.isActive ? (canDeactivate ? "btn-danger" : "admin-user-locked") : "admin-approve-btn"}`}
        onClick={onToggle}
        disabled={toggling || (user.isActive && !canDeactivate)}
        title={tooltip ?? undefined}
      >
        {toggling ? "..." : user.isActive ? "Deactivate" : "Approve"}
      </button>
    </div>
  );
}

function UsersTab({ auth }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(null);

  const [pendingInput,  setPendingInput]  = useState("");
  const [pendingQuery,  setPendingQuery]  = useState("");
  const [pendingPage,   setPendingPage]   = useState(1);

  const [activeInput,   setActiveInput]   = useState("");
  const [activeQuery,   setActiveQuery]   = useState("");
  const [activePage,    setActivePage]    = useState(1);

  useEffect(() => {
    getUsers(auth.token)
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.token]);

  async function handleToggle(userId, currentIsActive) {
    setToggling(userId);
    try {
      await setUserActive(auth.token, userId, !currentIsActive);
      setUsers((prev) =>
        prev.map((u) => u.userId === userId ? { ...u, isActive: !currentIsActive } : u)
      );
    } catch {
      // silent fail
    } finally {
      setToggling(null);
    }
  }

  const pendingUsers = users.filter((u) => !u.isActive);
  const activeUsers  = users.filter((u) => u.isActive);

  const filterByQuery = (list, query) =>
    query
      ? list.filter(
          (u) =>
            u.username?.toLowerCase().includes(query.toLowerCase()) ||
            u.email?.toLowerCase().includes(query.toLowerCase())
        )
      : list;

  const filteredPending = filterByQuery(pendingUsers, pendingQuery);
  const filteredActive  = filterByQuery(activeUsers,  activeQuery);

  const totalPendingPages = Math.max(1, Math.ceil(filteredPending.length / USER_PAGE_SIZE));
  const totalActivePages  = Math.max(1, Math.ceil(filteredActive.length  / USER_PAGE_SIZE));
  const safePendingPage   = Math.min(pendingPage, totalPendingPages);
  const safeActivePage    = Math.min(activePage,  totalActivePages);

  const paginatedPending = filteredPending.slice((safePendingPage - 1) * USER_PAGE_SIZE, safePendingPage * USER_PAGE_SIZE);
  const paginatedActive  = filteredActive.slice((safeActivePage  - 1) * USER_PAGE_SIZE, safeActivePage  * USER_PAGE_SIZE);

  if (loading) return <p className="muted">Loading users...</p>;

  return (
    <div className="admin-users-columns">
      {/* Pending Approval */}
      <div className="admin-users-section">
        <h3 className="admin-users-heading">
          Pending Approval
          <span className="admin-user-count">{pendingUsers.length}</span>
        </h3>
        <form
          className="talent-search"
          onSubmit={(e) => { e.preventDefault(); setPendingQuery(pendingInput); setPendingPage(1); }}
        >
          <input
            type="text"
            placeholder="Search by username or email..."
            value={pendingInput}
            onChange={(e) => setPendingInput(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        {paginatedPending.length === 0 ? (
          <p className="muted">
            {pendingUsers.length === 0 ? "No pending users." : "No users match your search."}
          </p>
        ) : (
          <div className="admin-user-list">
            {paginatedPending.map((u) => (
              <UserCard
                key={u.userId}
                user={u}
                onToggle={() => handleToggle(u.userId, u.isActive)}
                toggling={toggling === u.userId}
                currentUserId={auth.userId}
              />
            ))}
          </div>
        )}
        <UserPagination page={safePendingPage} total={totalPendingPages} onPage={setPendingPage} />
      </div>

      {/* Active Users */}
      <div className="admin-users-section">
        <h3 className="admin-users-heading">
          Active Users
          <span className="admin-user-count">{activeUsers.length}</span>
        </h3>
        <form
          className="talent-search"
          onSubmit={(e) => { e.preventDefault(); setActiveQuery(activeInput); setActivePage(1); }}
        >
          <input
            type="text"
            placeholder="Search by username or email..."
            value={activeInput}
            onChange={(e) => setActiveInput(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        {paginatedActive.length === 0 ? (
          <p className="muted">
            {activeUsers.length === 0 ? "No active users." : "No users match your search."}
          </p>
        ) : (
          <div className="admin-user-list">
            {paginatedActive.map((u) => (
              <UserCard
                key={u.userId}
                user={u}
                onToggle={() => handleToggle(u.userId, u.isActive)}
                toggling={toggling === u.userId}
                currentUserId={auth.userId}
              />
            ))}
          </div>
        )}
        <UserPagination page={safeActivePage} total={totalActivePages} onPage={setActivePage} />
      </div>
    </div>
  );
}

const TAG_OPTIONS = [
  { label: "Bastion",      value: 1 },
  { label: "Beast",        value: 2 },
  { label: "Hellion",      value: 3 },
  { label: "Quartermaster",value: 4 },
  { label: "Ranger",       value: 5 },
  { label: "Sanguinist",   value: 6 },
  { label: "Scoundrel",    value: 7 },
  { label: "Spellblade",   value: 8 },
  { label: "Stormcaller",  value: 9 },
  { label: "Viper",        value: 10 },
  { label: "Warrior",      value: 11 },
  { label: "Wizard",       value: 12 },
];

const TAG_LABEL = Object.fromEntries(TAG_OPTIONS.map(({ label, value }) => [value, label]));

const FETCH_FN = {
  Talents:    getTalents,
  Origins:    getOrigins,
  Visions:    getVisions,
  Techniques: getTechniques,
  Arcana:     getArcana,
};

const CONFIG = {
  Talents: {
    singular:      "Talent",
    getId:         (item) => item.talentId,
    getLabel:      (item) => item.name || "(unnamed)",
    toDisplayItems:(items) => items,
    emptyData:     ()     => ({ name: "", description: "", tag: 1 }),
    dataFromItem:  (item) => ({
      name:        item.name        || "",
      description: item.description || "",
      tag:         item.tag         || 1,
    }),
    createBody: (d)      => ({ name: d.name, description: d.description, tag: Number(d.tag) }),
    updateBody: (id, d)  => ({ talentId: id, name: d.name, description: d.description, tag: Number(d.tag) }),
    create: createTalent,
    update: updateTalent,
    delete: deleteTalent,
    renderCard: (item) => (
      <>
        <strong>{item.name}</strong>
        {item.description && <p>{item.description}</p>}
        {item.tag != null && (
          <span className="admin-tag-badge">{TAG_LABEL[item.tag] || item.tag}</span>
        )}
      </>
    ),
  },

  Origins: {
    singular:      "Origin",
    getId:         (item) => item.originId,
    getLabel:      (item) => item.descriptor || "(unnamed)",
    // Give each origin a synthetic `name` so PaginatedPickerList search works
    toDisplayItems:(items) => items.map((o) => ({ ...o, name: o.descriptor })),
    emptyData:     ()     => ({ descriptor: "", professionA: "", professionB: "", diceValue: "" }),
    dataFromItem:  (item) => ({
      descriptor:  item.descriptor  || "",
      professionA: item.professionA || "",
      professionB: item.professionB || "",
      diceValue:   item.diceValue  != null ? item.diceValue : "",
    }),
    createBody: (d) => ({
      descriptor:  d.descriptor,
      professionA: d.professionA,
      professionB: d.professionB,
      diceValue:   d.diceValue !== "" ? Number(d.diceValue) : null,
    }),
    updateBody: (id, d) => ({
      originId:    id,
      descriptor:  d.descriptor,
      professionA: d.professionA,
      professionB: d.professionB,
      diceValue:   d.diceValue !== "" ? Number(d.diceValue) : null,
    }),
    create: createOrigin,
    update: updateOrigin,
    delete: deleteOrigin,
    renderCard: (item) => (
      <>
        <strong>{item.descriptor}</strong>
        {(item.professionA || item.professionB) && (
          <p className="muted">
            {[item.professionA, item.professionB].filter(Boolean).join(" / ")}
          </p>
        )}
      </>
    ),
  },

  Visions: {
    singular:      "Vision",
    getId:         (item) => item.visionId,
    getLabel:      (item) => item.name || "(unnamed)",
    toDisplayItems:(items) => items,
    emptyData:     ()     => ({ name: "", description: "" }),
    dataFromItem:  (item) => ({
      name:        item.name        || "",
      description: item.description || "",
    }),
    createBody: (d)     => ({ name: d.name, description: d.description }),
    updateBody: (id, d) => ({ visionId: id, name: d.name, description: d.description }),
    create: createVision,
    update: updateVision,
    delete: deleteVision,
    renderCard: (item) => (
      <>
        <strong>{item.name}</strong>
        {item.description && <p>{item.description}</p>}
      </>
    ),
  },

  Techniques: {
    singular:      "Technique",
    getId:         (item) => item.techniqueId,
    getLabel:      (item) => item.name || "(unnamed)",
    toDisplayItems:(items) => items,
    emptyData:     ()     => ({ name: "", description: "", combo: "" }),
    dataFromItem:  (item) => ({
      name:        item.name        || "",
      description: item.description || "",
      combo:       item.combo       || "",
    }),
    createBody: (d)     => ({ name: d.name, description: d.description, combo: d.combo }),
    updateBody: (id, d) => ({ techniqueId: id, name: d.name, description: d.description, combo: d.combo }),
    create: createTechnique,
    update: updateTechnique,
    delete: deleteTechnique,
    renderCard: (item) => (
      <>
        <strong>{item.name}</strong>
        {item.description && <p>{item.description}</p>}
        {item.combo && (
          <div className="card-sub-section">
            <span className="card-sub-label">Combo:</span>
            <span className="card-sub-text">{item.combo}</span>
          </div>
        )}
      </>
    ),
  },

  Arcana: {
    singular:      "Arcana",
    getId:         (item) => item.arcanaId,
    getLabel:      (item) => item.name || "(unnamed)",
    toDisplayItems:(items) => items,
    emptyData:     ()     => ({ name: "", description: "", upcast: "" }),
    dataFromItem:  (item) => ({
      name:        item.name        || "",
      description: item.description || "",
      upcast:      item.upcast      || "",
    }),
    createBody: (d)     => ({ name: d.name, description: d.description, upcast: d.upcast }),
    updateBody: (id, d) => ({ arcanaId: id, name: d.name, description: d.description, upcast: d.upcast }),
    create: createArcana,
    update: updateArcana,
    delete: deleteArcana,
    renderCard: (item) => (
      <>
        <strong>{item.name}</strong>
        {item.description && <p>{item.description}</p>}
        {item.upcast && (
          <div className="card-sub-section">
            <span className="card-sub-label">Upcast:</span>
            <span className="card-sub-text">{item.upcast}</span>
          </div>
        )}
      </>
    ),
  },
};

function EditForm({ tab, editData, setEditData }) {
  const set = (field) => (e) =>
    setEditData((prev) => ({ ...prev, [field]: e.target.value }));

  switch (tab) {
    case "Talents":
      return (
        <>
          <div className="form-group">
            <label className="admin-label">Name</label>
            <input value={editData.name} onChange={set("name")} placeholder="Talent name" />
          </div>
          <div className="form-group">
            <label className="admin-label">Description</label>
            <textarea
              className="admin-textarea"
              value={editData.description}
              onChange={set("description")}
              placeholder="Description"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="admin-label">Tag</label>
            <select className="admin-select" value={editData.tag} onChange={set("tag")}>
              {TAG_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </>
      );

    case "Origins":
      return (
        <>
          <div className="form-group">
            <label className="admin-label">Descriptor</label>
            <input value={editData.descriptor} onChange={set("descriptor")} placeholder="e.g. Noble" />
          </div>
          <div className="admin-form-row">
            <div className="form-group">
              <label className="admin-label">Profession A</label>
              <input value={editData.professionA} onChange={set("professionA")} placeholder="e.g. Knight" />
            </div>
            <div className="form-group">
              <label className="admin-label">Profession B</label>
              <input value={editData.professionB} onChange={set("professionB")} placeholder="e.g. Guard" />
            </div>
          </div>
          <div className="form-group">
            <label className="admin-label">Dice Value</label>
            <input
              type="number"
              value={editData.diceValue}
              onChange={set("diceValue")}
              placeholder="e.g. 6"
            />
          </div>
        </>
      );

    case "Visions":
      return (
        <>
          <div className="form-group">
            <label className="admin-label">Name</label>
            <input value={editData.name} onChange={set("name")} placeholder="Vision name" />
          </div>
          <div className="form-group">
            <label className="admin-label">Description</label>
            <textarea
              className="admin-textarea"
              value={editData.description}
              onChange={set("description")}
              placeholder="Description"
              rows={3}
            />
          </div>
        </>
      );

    case "Techniques":
      return (
        <>
          <div className="form-group">
            <label className="admin-label">Name</label>
            <input value={editData.name} onChange={set("name")} placeholder="Technique name" />
          </div>
          <div className="form-group">
            <label className="admin-label">Description</label>
            <textarea
              className="admin-textarea"
              value={editData.description}
              onChange={set("description")}
              placeholder="Description"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="admin-label">Combo</label>
            <textarea
              className="admin-textarea"
              value={editData.combo}
              onChange={set("combo")}
              placeholder="Combo effect"
              rows={2}
            />
          </div>
        </>
      );

    case "Arcana":
      return (
        <>
          <div className="form-group">
            <label className="admin-label">Name</label>
            <input value={editData.name} onChange={set("name")} placeholder="Arcana name" />
          </div>
          <div className="form-group">
            <label className="admin-label">Description</label>
            <textarea
              className="admin-textarea"
              value={editData.description}
              onChange={set("description")}
              placeholder="Description"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="admin-label">Upcast</label>
            <textarea
              className="admin-textarea"
              value={editData.upcast}
              onChange={set("upcast")}
              placeholder="Upcast effect"
              rows={2}
            />
          </div>
        </>
      );

    default:
      return null;
  }
}

export default function AdminPortal() {
  const { auth } = useAuth();
  const [activeTab, setActiveTab]       = useState("Talents");
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isNew, setIsNew]               = useState(false);
  const [editData, setEditData]         = useState({});
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]           = useState(false);

  const isUsersTab = activeTab === "Users";
  const cfg = isUsersTab ? null : CONFIG[activeTab];

  useEffect(() => {
    if (isUsersTab) return;
    setLoading(true);
    setItems([]);
    FETCH_FN[activeTab](auth.token)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab, auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleItemClick(id) {
    const item = items.find((i) => cfg.getId(i) === id);
    if (!item) return;
    setSelectedItem(item);
    setIsNew(false);
    setEditData(cfg.dataFromItem(item));
    setError("");
  }

  function handleNewClick() {
    setSelectedItem(null);
    setIsNew(true);
    setEditData(cfg.emptyData());
    setError("");
  }

  function closeModal() {
    setSelectedItem(null);
    setIsNew(false);
    setEditData({});
    setError("");
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    closeModal();
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        await cfg.create(auth.token, cfg.createBody(editData));
      } else {
        const id = cfg.getId(selectedItem);
        await cfg.update(auth.token, cfg.updateBody(id, editData));
      }
      // Reload to reflect server state
      const data = await FETCH_FN[activeTab](auth.token);
      setItems(Array.isArray(data) ? data : []);
      closeModal();
    } catch (e) {
      setError(e.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await cfg.delete(auth.token, confirmDelete.id);
      setItems((prev) => prev.filter((i) => cfg.getId(i) !== confirmDelete.id));
      setConfirmDelete(null);
      closeModal();
    } catch {
      // silent fail — item may have already been removed
    } finally {
      setDeleting(false);
    }
  }

  const displayItems = cfg ? cfg.toDisplayItems(items) : [];
  const singularLabel = cfg ? cfg.singular : "";
  const modalOpen = selectedItem !== null || isNew;

  return (
    <div className="dashboard-wide">
      <header className="dashboard-header">
        <h1>Admin Portal</h1>
        {!isUsersTab && (
          <button className="btn admin-new-btn" onClick={handleNewClick}>
            + New {singularLabel}
          </button>
        )}
      </header>

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {isUsersTab ? (
        <UsersTab auth={auth} />
      ) : (
        <PaginatedPickerList
          key={activeTab}
          items={displayItems}
          loading={loading}
          emptyMessage={`No ${activeTab.toLowerCase()} found.`}
          noResultsMessage={`No ${activeTab.toLowerCase()} match your search.`}
          getId={cfg.getId}
          onSelect={handleItemClick}
          renderCardContent={cfg.renderCard}
        />
      )}

      {/* ── Edit / New modal ───────────────────────────── */}
      {!isUsersTab && modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{isNew ? `New ${singularLabel}` : `Edit ${singularLabel}`}</h2>

            {error && <div className="error">{error}</div>}

            <EditForm tab={activeTab} editData={editData} setEditData={setEditData} />

            <div className="modal-actions admin-modal-actions">
              <button
                className="btn admin-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="btn" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              {!isNew && (
                <button
                  className="btn btn-danger admin-modal-delete-btn"
                  onClick={() =>
                    setConfirmDelete({
                      id:   cfg.getId(selectedItem),
                      name: cfg.getLabel(selectedItem),
                    })
                  }
                  disabled={saving}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────── */}
      {!isUsersTab && confirmDelete && (
        <div className="modal-overlay admin-confirm-overlay">
          <div className="modal">
            <h2>Delete {singularLabel}</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{confirmDelete.name}</strong>?
            </p>
            <p className="modal-warning">
              This is permanent and cannot be undone. Any characters referencing
              this {singularLabel.toLowerCase()} may be affected.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
              <button
                className="btn"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
