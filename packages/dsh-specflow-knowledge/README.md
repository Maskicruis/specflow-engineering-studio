# SpecFlow tools for DeepSeek Harness

This local DSH plugin connects DeepSeek Harness Studio to a running SpecFlow Engineering Studio instance.

It registers `specflow_status`, `specflow_list_groups`, `specflow_search`, and `specflow_ask`. Search now includes engineering-term expansion and an explicit clarification contract. When a question is underspecified, Harness asks the returned follow-up questions before giving a conclusion.

Every search hit includes an absolute `sourceUrl` plus a ready-to-use Markdown `markdownLink`. Clicking it sends the citation to the already-running SpecFlow desktop reader, selects the page, and highlights the matching source block.

The SpecFlow installer also deploys the companion `/specflow-design-review` DSH Skill. Invoke it with an engineering document path to run the standard status, group selection, grounded search, compliance matrix, and non-destructive revision workflow without repeating a long prompt.

SpecFlow writes its current loopback service address to `%USERPROFILE%\.dsh\integrations\specflow.json`. The plugin reads that discovery record for every call, so a fallback or user-configured SpecFlow port continues to work without duplicating settings in Harness.

Install or update both components from SpecFlow under **Settings → DeepSeek Harness connection**. Restart DeepSeek Harness Studio after installation so its plugin composition reloads. Skills are stored under `%USERPROFILE%\.dsh\skills`; no DeepSeek Harness Studio source files are changed.
