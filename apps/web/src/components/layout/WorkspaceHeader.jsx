import { Activity, Menu, Search } from "lucide-react";

export default function WorkspaceHeader({
  title,
  user,
  roleLabel,
  onOpenMenu,
  onSignOut,
  onActivity,
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-stone-200 bg-white/90 px-5 backdrop-blur md:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpenMenu} aria-label="Open navigation menu" className="shrink-0 rounded-lg border border-stone-200 p-2 text-stone-700 hover:bg-stone-50 lg:hidden">
          <Menu size={20}/>
        </button>
        <div className="min-w-0">
          <p className="text-xs text-stone-500">Workspace / {title}</p>
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* <label className="hidden items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-400 md:flex">
          <Search size={16}/>Search anything...
          <span className="ml-5 rounded border border-stone-200 px-1.5 py-0.5 text-[10px]">Ctrl K</span>
        </label> */}
        {onActivity && (
          <button type="button" aria-label="View activity" onClick={onActivity} className="rounded-lg border border-stone-200 p-2.5 text-stone-600 hover:bg-stone-50"><Activity size={18}/></button>
        )}
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-stone-800">{user?.name || user?.fullName || user?.email}</p>
          <p className="text-[11px] capitalize text-stone-500">{roleLabel}</p>
        </div>
        <button type="button" onClick={onSignOut} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50">Sign out</button>
      </div>
    </header>
  );
}
