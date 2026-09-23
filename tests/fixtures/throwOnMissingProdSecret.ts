import { getRequiredSecret } from "../../lib/env";

getRequiredSecret("SOME_TEST_SECRET_NOT_SET_ANYWHERE");
