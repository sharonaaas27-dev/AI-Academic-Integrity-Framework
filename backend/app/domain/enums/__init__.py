from enum import Enum, IntEnum


class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    EXAM_CONTROLLER = "exam_controller"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class ExamStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SINGLE_CHOICE = "single_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    CODE = "code"
    FILE_UPLOAD = "file_upload"


class RiskLevel(str, Enum):
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EventType(str, Enum):
    MOUSE_MOVE = "mouse_move"
    MOUSE_CLICK = "mouse_click"
    MOUSE_IDLE = "mouse_idle"
    KEY_DOWN = "key_down"
    KEY_UP = "key_up"
    KEY_COPY = "key_copy"
    KEY_PASTE = "key_paste"
    WINDOW_BLUR = "window_blur"
    WINDOW_FOCUS = "window_focus"
    FULLSCREEN_EXIT = "fullscreen_exit"
    BROWSER_RESIZE = "browser_resize"
    DEVTOOLS_OPEN = "devtools_open"
    TAB_VISIBILITY = "tab_visibility"
    TAB_HIDDEN = "tab_hidden"
    NAVIGATION = "navigation"
    NETWORK_DISCONNECT = "network_disconnect"
    NETWORK_RECONNECT = "network_reconnect"
    ANSWER_CHANGE = "answer_change"
    QUESTION_NAVIGATE = "question_navigate"
    HEARTBEAT = "heartbeat"
    EXAM_START = "exam_start"
    EXAM_SUBMIT = "exam_submit"
    REFRESH = "refresh"
    ALT_TAB = "alt_tab"


class FeatureName(str, Enum):
    FOCUS_SWITCH_COUNT = "focus_switch_count"
    AVG_FOCUS_LOSS_DURATION = "avg_focus_loss_duration"
    AVG_RESPONSE_TIME = "avg_response_time"
    TYPING_INTERVAL_MEAN = "typing_interval_mean"
    TYPING_INTERVAL_STD = "typing_interval_std"
    MOUSE_ENTROPY = "mouse_entropy"
    MOUSE_VELOCITY_MEAN = "mouse_velocity_mean"
    MOUSE_VELOCITY_STD = "mouse_velocity_std"
    MOUSE_ACCELERATION_MEAN = "mouse_acceleration_mean"
    IDLE_RATIO = "idle_ratio"
    QUESTION_SWITCH_FREQUENCY = "question_switch_frequency"
    ANSWER_EDIT_COUNT = "answer_edit_count"
    FULLSCREEN_EXIT_COUNT = "fullscreen_exit_count"
    DEVTOOL_ATTEMPT_COUNT = "devtool_attempt_count"
    COPY_COUNT = "copy_count"
    PASTE_COUNT = "paste_count"
    NETWORK_DISCONNECT_COUNT = "network_disconnect_count"
    HEARTBEAT_MISS_RATIO = "heartbeat_miss_ratio"
    ANSWER_REVISIT_COUNT = "answer_revisit_count"
    KEYBOARD_RHYTHM_STD = "keyboard_rhythm_std"


class NotificationType(str, Enum):
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    EXAM_COMPLETED = "exam_completed"
    RISK_THRESHOLD = "risk_threshold"
    EXAM_STARTING = "exam_starting"
    SYSTEM_ALERT = "system_alert"
    USER_MENTION = "user_mention"


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    WEBHOOK = "webhook"


class AuditAction(str, Enum):
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    EXAM_CREATED = "exam_created"
    EXAM_UPDATED = "exam_updated"
    EXAM_DELETED = "exam_deleted"
    EXAM_STARTED = "exam_started"
    EXAM_PAUSED = "exam_paused"
    EXAM_COMPLETED = "exam_completed"
    EXAM_SUBMITTED = "exam_submitted"
    QUESTION_CREATED = "question_created"
    QUESTION_UPDATED = "question_updated"
    QUESTION_DELETED = "question_deleted"
    RISK_REPORT_VIEWED = "risk_report_viewed"
    RISK_REVIEW_ACTION = "risk_review_action"
    BEHAVIOR_EVENT_RECEIVED = "behavior_event_received"
    RULE_CREATED = "rule_created"
    RULE_UPDATED = "rule_updated"
    RULE_DELETED = "rule_deleted"
    SETTINGS_UPDATED = "settings_updated"
    NOTIFICATION_SENT = "notification_sent"
    MODEL_DEPLOYED = "model_deployed"
    EXPORT_DATA = "export_data"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DeviceType(str, Enum):
    DESKTOP = "desktop"
    TABLET = "tablet"
    MOBILE = "mobile"
    UNKNOWN = "unknown"


class BrowserName(str, Enum):
    CHROME = "chrome"
    FIREFOX = "firefox"
    SAFARI = "safari"
    EDGE = "edge"
    OPERA = "opera"
    UNKNOWN = "unknown"
