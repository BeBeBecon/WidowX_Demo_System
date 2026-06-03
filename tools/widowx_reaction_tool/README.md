# WidowX Reaction Tool

RealSense depth で人の位置を left / center / right に推定し、LLM が選んだ action に応じて WidowX の記録済みエピソードを replay するツールです。

## 入口

他ツールからは以下のいずれかを実行します。

```bash
/home/share/widowx_reaction_tool/run_wavehands.sh
/home/share/widowx_reaction_tool/run_yes.sh
/home/share/widowx_reaction_tool/run_no.sh
