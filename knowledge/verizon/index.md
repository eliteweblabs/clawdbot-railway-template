# Verizon Call Forwarding

Configure conditional call forwarding on Verizon lines.

## PSTN Numbers

If VAPI gave you a regular 10-digit number (+1XXX...), use Verizon dial codes:

### Enable No-Answer Forwarding
```
*92*1[XXXXXXXXXX]#
```
Replace `[XXXXXXXXXX]` with the VAPI number.

### Set Ring Count
```
**61*1[XXXXXXXXXX]*[XX]#
```
`[XX]` = number of rings before forwarding (typically 2-6)

## SIP Endpoints

If VAPI gave you a SIP/trunk address, configure forwarding through VAPI's dashboard or API instead.

## Notes

- Dial codes only work for regular PSTN phone numbers
- Dial from the Verizon line itself (app or phone dialer)
- Programs carrier-side forwarding