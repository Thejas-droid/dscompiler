/// <reference types="vite/client" />
declare module "virtual:ds-report" {
  import type { InspectionReport } from "@dsc/enforcer";
  export function readReport(): Promise<InspectionReport | null>;
  export function subscribeReport(
    listener: (report: InspectionReport) => void,
  ): () => void;
}
