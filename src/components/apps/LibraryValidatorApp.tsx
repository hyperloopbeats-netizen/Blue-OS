import { clusterLibraryEngine } from '../../kernel/ClusterLibraryEngine';
import type { ClusterLibraryEntry, LibraryValidationReport } from '../../kernel/types';

interface LibraryValidatorAppProps {
  entries: ClusterLibraryEntry[];
  report: LibraryValidationReport;
  onSelectForFix?: (id: string) => void;
}

export function LibraryValidatorApp({ entries, report, onSelectForFix }: LibraryValidatorAppProps) {
  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Library Growth &amp; Integrity Validator ({entries.length} Modules Checked)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Verifies syntax balance, capability coverage, FNV-1a hashes, and non-destructive growth past 24 modules
          </p>
        </div>

        <button
          type="button"
          onClick={() => clusterLibraryEngine.validateAll(true)}
          className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Re-Validate All {entries.length} Modules
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Integrity Score</div>
          <div
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              report.healthPct >= 95 ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {report.healthPct}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {report.passedCount}/{report.checkedCount} verified
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Synthetic Growth</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">
            +{report.growthCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {entries.length} total (24 base)
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Modified Base</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {report.modifiedCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Live overrides synced</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Warnings / Faults</div>
          <div
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              report.warningCount + report.faultCount > 0 ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {report.warningCount} / {report.faultCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Structural syntax checks</div>
        </div>
      </div>

      {report.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-amber-200">Detected Validation Notices</h4>
          <div className="space-y-1.5">
            {report.issues.map((issue) => (
              <div
                key={`${issue.moduleId}-${issue.message}`}
                className="px-3.5 py-2 rounded-lg bg-white/[0.03] border border-amber-400/30 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-slate-100">{issue.moduleName}</span>
                  <span className="text-slate-400"> · {issue.message}</span>
                </div>
                {onSelectForFix && (
                  <button
                    type="button"
                    onClick={() => onSelectForFix(issue.moduleId)}
                    className="px-2.5 py-1 text-xs rounded bg-white/[0.07] hover:bg-white/[0.12] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Inspect in Writer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-white/[0.08] rounded-lg overflow-hidden">
        <div className="max-h-[290px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-white/[0.04] text-slate-400 sticky top-0">
              <tr>
                <th className="py-2 px-3 font-medium">#</th>
                <th className="py-2 px-3 font-medium">Module</th>
                <th className="py-2 px-3 font-medium">Origin</th>
                <th className="py-2 px-3 font-medium">FNV-1a</th>
                <th className="py-2 px-3 font-medium text-right">Size</th>
                <th className="py-2 px-3 font-medium text-right">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {entries.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-white/[0.03]">
                  <td className="py-2 px-3 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-100">{entry.name}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-300">{entry.origin}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-sky-300">{entry.fnvHex}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-300">
                    {entry.sizeBytes.toLocaleString()}B
                  </td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-400">v{entry.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
