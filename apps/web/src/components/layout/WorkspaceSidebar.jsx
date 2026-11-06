import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
//  CircleHelp, Settings2,
export default function WorkspaceSidebar({
  navigation,
  currentPage,
  onNavigate,
  user,
  mobileOpen,
  onClose,
  roleLabel,
  requisitionCount,
  loadingRequisitions,
}) {
  const initials = (user?.name || user?.fullName || user?.email || "U")
    .split(/[\\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function NavItems({ mobile = false }) {
  return navigation.map(({ id, label, icon: Icon }) => {
    const activeClass =
      "bg-[#edf3e8] font-semibold text-[#24432b]";

    const inactiveClass =
      "text-stone-600 hover:bg-stone-50";

    return (
      <NavLink
        key={id}
        to={`/${roleLabel.toLowerCase()}/${id}`}
        onClick={() => {
          if (mobile) onClose();
        }}
        className={({ isActive }) =>
          `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
            isActive ? activeClass : inactiveClass
          }`
        }
      >
        <Icon size={18} />
        <span>{label}</span>
        {id === "requisitions" && (
          <span className="ml-auto rounded-md bg-stone-100 px-2 py-0.5 text-xs">
            {loadingRequisitions ? "—" : requisitionCount}
          </span>
        )}
      </NavLink>
    );
  });
}
  const Profile = () => (
    <div className="flex items-center gap-3 border-t border-stone-100 px-2 pt-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6e9df] text-xs font-semibold">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {user?.name || user?.fullName || user?.email}
        </p>
        <p className="text-xs capitalize text-stone-500">{roleLabel}</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-stone-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17251b] text-sm font-bold text-[#d6f2a3]">T</div>
          <div>
            <p className="text-[15px] font-bold tracking-tight">TalentLens</p>
            <p className="text-[11px] text-stone-500">{roleLabel} workspace</p>
          </div>
        </div>
        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Workspace</p>
          <nav className="space-y-1"><NavItems /></nav>
        </div>
        <div className="mt-auto space-y-2 border-t border-stone-100 p-4">
          {/* <button onClick={() => onNavigate("settings")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50"><Settings2 size={18}/>Settings</button>
          <button onClick={() => onNavigate("help")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50"><CircleHelp size={18}/>Help & support</button> */}
          <Profile />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation menu" onClick={onClose} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(82vw,320px)] flex-col border-r border-stone-200 bg-white shadow-2xl">
            <div className="flex h-[76px] items-center justify-between border-b border-stone-100 px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17251b] font-bold text-[#d6f2a3]">T</div>
                <div><p className="text-sm font-bold">TalentLens</p><p className="text-[11px] text-stone-500">{roleLabel} workspace</p></div>
              </div>
              <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Workspace</p>
              <nav className="space-y-1"><NavItems mobile /></nav>
            </div>
            <div className="border-t border-stone-100 p-4"><Profile /></div>
          </aside>
        </div>
      )}
    </>
  );
}
