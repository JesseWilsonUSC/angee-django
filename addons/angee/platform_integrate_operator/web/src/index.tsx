import { defineBaseAddon } from "@angee/app";
import { CONSOLE_NOTICE_SLOT } from "@angee/ui";

import { RestartNotice } from "./RestartNotice";
import { enPlatformIntegrateOperatorMessages } from "./i18n";

export default defineBaseAddon({
  id: "platform_integrate_operator",
  i18n: { platformIntegrateOperator: enPlatformIntegrateOperatorMessages },
  slots: [{
    slot: CONSOLE_NOTICE_SLOT,
    id: "platform_integrate_operator.restart",
    content: <RestartNotice />,
  }],
});
