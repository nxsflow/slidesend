import { packageName } from "@nxsflow/slidesend-core/server";
import { secret } from "./server";

export const helper = `${packageName}:${secret}`;
