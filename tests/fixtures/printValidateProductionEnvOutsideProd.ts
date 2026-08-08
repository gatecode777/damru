import { validateProductionEnv } from "../../lib/env";

process.stdout.write(JSON.stringify(validateProductionEnv()));
