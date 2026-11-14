import { handleSensor, type SensorEnv } from "../../src/sensor";

export default {
  fetch: (request: Request, env: SensorEnv, ctx: ExecutionContext) => handleSensor(request, env, ctx),
} satisfies ExportedHandler<SensorEnv>;
