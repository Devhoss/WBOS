import type { DerivedShipmentState } from "@/domains/import-shipments/stage/compute-shipment-state";
import { IMPORT_SHIPMENT_STAGES, stageLabel } from "@/domains/import-shipments/stage/compute-shipment-state";

export function StageStepper({ state }: { state: DerivedShipmentState }) {
  const { stageIndex } = state;

  return (
    <ol className="flex flex-wrap items-center gap-1">
      {IMPORT_SHIPMENT_STAGES.map((stage, index) => {
        const done = index < stageIndex;
        const current = index === stageIndex;
        return (
          <li key={stage} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                current
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? "✓ " : ""}{stageLabel(stage)}
            </span>
            {index < IMPORT_SHIPMENT_STAGES.length - 1 ? (
              <span className="h-px w-3 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}