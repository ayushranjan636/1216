# Database Schema

SQLite database at `server/data/1216.db`.

## `users`

| Column | Type | Description |
|--------|------|-------------|
| `uid` | TEXT PK | User ID |
| `username` | TEXT | Login username |
| `display_name` | TEXT | Display name |
| `email` | TEXT | Email |
| `slot` | TEXT | `ayush` or `partner` |

## `messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Message ID |
| `conversation_id` | TEXT | Always `1216-private-chat` |
| `sender_id` | TEXT | Sender UID |
| `type` | TEXT | `text`, `image`, `video`, `snap`, `daily_note` |
| `text` | TEXT | Message content |
| `media_url` | TEXT | Uploaded media path |
| `media_thumbnail` | TEXT | Video thumbnail |
| `reply_to_id` | TEXT | Reply target message ID |
| `reply_to_preview` | TEXT | Reply preview text |
| `reactions` | TEXT | JSON array of `{ type, userId }` |
| `status` | TEXT | `sent`, `delivered`, `seen` |
| `edited_at` | INTEGER | Edit timestamp (ms) |
| `deleted_at` | INTEGER | Soft delete timestamp |
| `created_at` | INTEGER | Created timestamp (ms) |
| `read_by` | TEXT | JSON array of user IDs |
| `view_once` | INTEGER | 1 if view-once media |
| `viewed_by` | TEXT | JSON array of user IDs who viewed |

## `calls`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Call ID |
| `caller_id` | TEXT | Caller UID |
| `callee_id` | TEXT | Callee UID |
| `type` | TEXT | `voice` or `video` |
| `status` | TEXT | `ringing`, `connecting`, `active`, `ended`, `missed`, `declined` |
| `started_at` | INTEGER | Start timestamp |
| `ended_at` | INTEGER | End timestamp |
| `duration` | INTEGER | Duration in seconds |

## `call_signals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Signal ID |
| `call_id` | TEXT | Related call |
| `from_id` | TEXT | Sender UID |
| `to_id` | TEXT | Recipient UID |
| `type` | TEXT | `offer`, `answer`, `ice` |
| `payload` | TEXT | JSON WebRTC payload |
| `created_at` | INTEGER | Timestamp (ms) |
