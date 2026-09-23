import { getRequiredSecret } from "../../lib/env";

process.stdout.write(getRequiredSecret("SOME_TEST_SECRET_NOT_SET_ANYWHERE"));
