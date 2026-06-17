package notifications

// Embed IANA timezone database so LoadLocation works in minimal containers (Alpine without tzdata).
import _ "time/tzdata"
