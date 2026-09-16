# SpecFlow tools for DeepSeek Harness

This local DSH plugin connects DeepSeek Harness Studio to a running SpecFlow Engineering Studio instance.

It registers `specflow_status`, `specflow_list_groups`, `specflow_search`, and `specflow_ask`.

SpecFlow writes its current loopback service address to `%USERPROFILE%\.dsh\integrations\specflow.json`. The plugin reads that discovery record for every call, so a fallback or user-configured SpecFlow port continues to work without duplicating settings in Harness.

Install or update it from SpecFlow under **Settings → DeepSeek Harness connection**. Restart DeepSeek Harness Studio after installation so its plugin composition reloads.
