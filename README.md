## Disclaimer

To avoid unnecessary resource consumption caused by downstream forks repeatedly triggering the 'IP workflow', a new 'Upstream Sync' workflow has been added to automatically keep forked repositories in sync with this one.
Since GitHub’s Terms of Service prohibit individuals from registering multiple free accounts, I am currently unable to perform full testing or verification myself.
If you encounter and confirm any unexpected execution after forking, please feel free to contact me or let me know.

## Diagram

```
              ┌-------------------------┐
ISP ⇠cf cdn⇢ |        worker           | ⇠(direct)⇢ remote
--------------┼-------------------------┼-------------------------------
              | (direct) incoming data ?├┈┈no┈→ proxy ←┈cf cdn┈→ remote
              └-------------------------┘
after:

              ┌--------------------------┐  no ┈┈(direct)┈→ remote
ISP ⇠cf cdn⇢ |        worker            |  /                   ↕
              | remote in cfcidr/cfhost ?├ ┈┈yes┈→ Hit proxy ←→ cf cdn
--------------┴-----------------------⇡--┴-------------------------------
               tag remote into cfhost ┊no
              ┌-----------------------┴--┐
              | (direct) incoming data ? ├┈┈no┈→ proxy ←┈cf cdn┈→ remote
              └--------------------------┘
```
