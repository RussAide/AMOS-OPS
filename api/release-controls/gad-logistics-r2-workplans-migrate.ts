import { runGadLogisticsR2WorkplanMigration } from "./gad-logistics-r2-migration";

runGadLogisticsR2WorkplanMigration()
  .then((result) => {
    console.log(
      "GAD_LOGISTICS_R2_MIGRATION_RESULT=" + JSON.stringify(result),
    );
  })
  .catch((error: unknown) => {
    console.error(
      "GAD_LOGISTICS_R2_MIGRATION_FAILED=" +
        (error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  });
