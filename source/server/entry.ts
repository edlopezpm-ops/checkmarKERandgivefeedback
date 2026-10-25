import worker from "./worker.ts";
import { isDemoMediaRequest, serveDemoMedia } from "./demo-media.ts";

export default {
  scheduled(controller, env, ctx) { return worker.scheduled(controller, env, ctx); },
  fetch(request, env, ctx) {
    if (isDemoMediaRequest(request)) return serveDemoMedia(request, env.ASSETS);
    return worker.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
export { StudioProcessor } from "./studio-processor.ts";
