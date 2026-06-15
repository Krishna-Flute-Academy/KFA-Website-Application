


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only insert if a row doesn't already exist (avoid duplicate from client-side insert)
  INSERT INTO public.users (id, name, email, phone, role, status, join_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    'active',
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING; -- Safe: client-side insert already ran if session was available
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_role_student"("u_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT role = 'student' FROM public.users WHERE id = u_id;
$$;


ALTER FUNCTION "public"."is_role_student"("u_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_teacher_of_student"("s_id" "uuid", "t_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = s_id AND teacher_id = t_id
  );
$$;


ALTER FUNCTION "public"."is_teacher_of_student"("s_id" "uuid", "t_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_classroom"("c_id" "uuid", "t_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  -- This function runs as owner and bypasses RLS, breaking the recursion loop
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms 
    WHERE id = c_id AND teacher_id = t_id
  );
$$;


ALTER FUNCTION "public"."owns_classroom"("c_id" "uuid", "t_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_classroom_teacher_to_students"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (OLD.teacher_id IS DISTINCT FROM NEW.teacher_id) THEN
    UPDATE public.users
    SET teacher_id = NEW.teacher_id
    WHERE id IN (
      SELECT student_id 
      FROM public.classroom_students 
      WHERE classroom_id = NEW.id
    ) AND role = 'student';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_classroom_teacher_to_students"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_student_teacher_on_enrollment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_teacher_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.classroom_id IS DISTINCT FROM NEW.classroom_id) THEN
    -- Get the teacher_id of the classroom
    SELECT teacher_id INTO v_teacher_id
    FROM public.classrooms
    WHERE id = NEW.classroom_id;
    
    -- Sync to the student
    UPDATE public.users
    SET teacher_id = v_teacher_id
    WHERE id = NEW.student_id AND role = 'student';
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Get the teacher_id of the classroom
    SELECT teacher_id INTO v_teacher_id
    FROM public.classrooms
    WHERE id = OLD.classroom_id;
    
    -- Only set to null if it currently matches the teacher of the classroom being removed
    UPDATE public.users
    SET teacher_id = NULL
    WHERE id = OLD.student_id 
      AND teacher_id = v_teacher_id 
      AND role = 'student';
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_student_teacher_on_enrollment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_prepaid_classes_on_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('present', 'late') AND NEW.status NOT IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = NEW.student_id;
        ELSIF OLD.status NOT IN ('present', 'late') AND NEW.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = OLD.student_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_prepaid_classes_on_attendance"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assignment_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "score" numeric,
    "proficiency_level" "text",
    "feedback_text" "text",
    "video_url" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assignment_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "target_type" "text" DEFAULT 'all'::"text" NOT NULL,
    "file_url" "text",
    "file_name" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "inventory_ref_type" "text",
    "inventory_ref_id" "text",
    "inventory_ref_title" "text",
    CONSTRAINT "assignments_inventory_ref_type_check" CHECK (("inventory_ref_type" = ANY (ARRAY['module'::"text", 'chapter'::"text", 'lesson'::"text"])))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attempt_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid",
    "video_url" "text",
    "feedback_text" "text",
    "feedback_audio_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."attempt_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "marked_by" "uuid",
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "attendance_role_check" CHECK ("public"."is_role_student"("student_id")),
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'late'::"text", 'excused'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "batch_schedules_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "batch_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."batch_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "featured_image" "text",
    "author_name" "text" DEFAULT 'Krishna Flute Academy'::"text",
    "author_email" "text",
    "published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "view_count" integer DEFAULT 0,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'announcements'::"text" NOT NULL,
    "recipients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "audio_attachment" "text"
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "file_url" "text",
    "file_name" "text",
    "file_size" integer,
    "color" "text" DEFAULT 'yellow'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_inventory_allocation" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "classroom_id" "uuid",
    "module_id" "uuid",
    "chapter_id" "uuid",
    "lesson_id" "uuid",
    "allocated_by" "uuid",
    "allocated_to_student_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."classroom_inventory_allocation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_session_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "session_type" "text" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone NOT NULL,
    "duration_seconds" integer NOT NULL,
    "present_count" integer DEFAULT 0,
    "absent_count" integer DEFAULT 0,
    "late_count" integer DEFAULT 0,
    "excused_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."classroom_session_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "classroom_students_role_check" CHECK ("public"."is_role_student"("student_id"))
);


ALTER TABLE "public"."classroom_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classrooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'permanent'::"text",
    "teacher_id" "uuid" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "classrooms_type_check" CHECK (("type" = ANY (ARRAY['permanent'::"text", 'temporary'::"text"])))
);


ALTER TABLE "public"."classrooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "chapter_number" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "lesson_number" integer DEFAULT 1 NOT NULL,
    "material_type" "text" DEFAULT 'pdf'::"text" NOT NULL,
    "material_url" "text",
    "file_name" "text",
    "file_size" "text",
    "duration" "text",
    "is_introductory" boolean DEFAULT false,
    "is_very_important" boolean DEFAULT false,
    "bullet_points" "text"[] DEFAULT '{}'::"text"[],
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "link_url" "text"
);


ALTER TABLE "public"."course_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "module_number" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid"
);


ALTER TABLE "public"."course_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_recipient_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "recipients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_recipient_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "registration_link" "text" NOT NULL,
    "image_url" "text",
    "button_text" "text" DEFAULT 'Register Now'::"text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "billing_month" "date" NOT NULL,
    "payment_date" timestamp with time zone,
    "payment_method" "text",
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "fees_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'pending'::"text"]))),
    CONSTRAINT "fees_role_check" CHECK ("public"."is_role_student"("student_id"))
);


ALTER TABLE "public"."fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fees_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL
);


ALTER TABLE "public"."fees_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fees_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" NOT NULL,
    "classes_added" integer DEFAULT 4 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fees_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "description" "text",
    "media_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "thumbnail_url" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gallery_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text" NOT NULL,
    "course" "text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "category_id" integer,
    "level_id" integer,
    CONSTRAINT "inventory_file_type_check" CHECK (("file_type" = ANY (ARRAY['image'::"text", 'pdf'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."inventory_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."inventory_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."inventory_categories_id_seq" OWNED BY "public"."inventory_categories"."id";



CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."levels_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."levels_id_seq" OWNED BY "public"."levels"."id";



CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "message_text" "text" NOT NULL,
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['task'::"text", 'feedback'::"text", 'reminder'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_student_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "target_classroom_id" "uuid" NOT NULL,
    "override_date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."session_student_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_topic_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'locked'::"text" NOT NULL,
    "unlocked_by" "text" DEFAULT 'system'::"text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."student_topic_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "video_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "feedback_text" "text",
    "feedback_audio_url" "text",
    "submitted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "reviewed_at" timestamp with time zone,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "score" integer DEFAULT 0,
    "proficiency" "text" DEFAULT 'beginner'::"text",
    CONSTRAINT "submissions_proficiency_check" CHECK (("proficiency" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "submissions_role_check" CHECK ("public"."is_role_student"("student_id")),
    CONSTRAINT "submissions_score_check" CHECK ((("score" >= 0) AND ("score" <= 100))),
    CONSTRAINT "submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'submitted'::"text", 'reviewed'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "student_id" "uuid",
    "attempt_number" integer NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text",
    "submitted_at" timestamp without time zone DEFAULT "now"(),
    "reviewed_at" timestamp without time zone
);


ALTER TABLE "public"."task_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "task_type" "text" DEFAULT 'text'::"text",
    "classroom_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['text'::"text", 'inventory'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temporary_class_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "temporary_class_id" "uuid",
    "student_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."temporary_class_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temporary_classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid",
    "teacher_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Temporary Class'::"text" NOT NULL,
    "class_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "temporary_classes_check" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."temporary_classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "rating" integer DEFAULT 5,
    "location" "text" DEFAULT 'Google Review'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'student'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "student_serial_id" integer NOT NULL,
    "join_date" "date" DEFAULT CURRENT_DATE,
    "level" "text",
    "notes" "text",
    "teacher_id" "uuid",
    "profile_pic_url" "text",
    "fees_basis" "text" DEFAULT 'monthly'::"text",
    "fees_amount" numeric DEFAULT 0,
    "fees_collection_date" "date",
    "fees_classes_paid" integer DEFAULT 0,
    CONSTRAINT "users_level_check" CHECK (("level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text", 'pending'::"text"]))),
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_student_serial_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_student_serial_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_student_serial_id_seq" OWNED BY "public"."users"."student_serial_id";



ALTER TABLE ONLY "public"."inventory_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."inventory_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "student_serial_id" SET DEFAULT "nextval"('"public"."users_student_serial_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."assignment_students"
    ADD CONSTRAINT "assignment_students_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."assignment_students"
    ADD CONSTRAINT "assignment_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attempt_files"
    ADD CONSTRAINT "attempt_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_schedules"
    ADD CONSTRAINT "batch_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "class_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_session_logs"
    ADD CONSTRAINT "classroom_session_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_students"
    ADD CONSTRAINT "classroom_students_classroom_id_student_id_key" UNIQUE ("classroom_id", "student_id");



ALTER TABLE ONLY "public"."classroom_students"
    ADD CONSTRAINT "classroom_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_categories"
    ADD CONSTRAINT "course_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."course_categories"
    ADD CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_chapters"
    ADD CONSTRAINT "course_chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_lessons"
    ADD CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_recipient_groups"
    ADD CONSTRAINT "custom_recipient_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fees_notifications"
    ADD CONSTRAINT "fees_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fees_payments"
    ADD CONSTRAINT "fees_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fees"
    ADD CONSTRAINT "fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gallery_items"
    ADD CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_student_overrides"
    ADD CONSTRAINT "session_student_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_student_overrides"
    ADD CONSTRAINT "session_student_overrides_student_id_target_classroom_id_ov_key" UNIQUE ("student_id", "target_classroom_id", "override_date");



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_student_id_lesson_id_key" UNIQUE ("student_id", "lesson_id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_attempts"
    ADD CONSTRAINT "task_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_inventory"
    ADD CONSTRAINT "task_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_inventory"
    ADD CONSTRAINT "task_inventory_task_id_inventory_id_key" UNIQUE ("task_id", "inventory_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temporary_class_students"
    ADD CONSTRAINT "temporary_class_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temporary_classes"
    ADD CONSTRAINT "temporary_classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_schedules"
    ADD CONSTRAINT "unique_batch_schedule" UNIQUE ("classroom_id", "day_of_week", "start_time");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "unique_student_attendance" UNIQUE ("student_id", "classroom_id", "date");



ALTER TABLE ONLY "public"."fees"
    ADD CONSTRAINT "unique_student_billing_month" UNIQUE ("student_id", "billing_month");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "course_chapters_module_chapter_uidx" ON "public"."course_chapters" USING "btree" ("module_id", "chapter_number");



CREATE UNIQUE INDEX "course_lessons_chapter_lesson_uidx" ON "public"."course_lessons" USING "btree" ("chapter_id", "lesson_number");



CREATE INDEX "idx_attendance_classroom_date" ON "public"."attendance" USING "btree" ("classroom_id", "date");



CREATE INDEX "idx_batch_schedule_classroom" ON "public"."batch_schedules" USING "btree" ("classroom_id");



CREATE INDEX "idx_class_sessions_classroom_date" ON "public"."class_sessions" USING "btree" ("classroom_id", "session_date");



CREATE INDEX "idx_temp_classes_date" ON "public"."temporary_classes" USING "btree" ("class_date");



CREATE OR REPLACE TRIGGER "on_classroom_teacher_changed" AFTER UPDATE OF "teacher_id" ON "public"."classrooms" FOR EACH ROW EXECUTE FUNCTION "public"."sync_classroom_teacher_to_students"();



CREATE OR REPLACE TRIGGER "on_student_enrollment_changed" AFTER INSERT OR DELETE OR UPDATE ON "public"."classroom_students" FOR EACH ROW EXECUTE FUNCTION "public"."sync_student_teacher_on_enrollment"();



CREATE OR REPLACE TRIGGER "trg_attendance_fees_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_prepaid_classes_on_attendance"();



ALTER TABLE ONLY "public"."attempt_files"
    ADD CONSTRAINT "attempt_files_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."task_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_schedules"
    ADD CONSTRAINT "batch_schedules_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_assigned_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_assigned_to_student_id_fkey" FOREIGN KEY ("allocated_to_student_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."course_chapters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classroom_inventory_allocation"
    ADD CONSTRAINT "classroom_inventory_assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classroom_session_logs"
    ADD CONSTRAINT "classroom_session_logs_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_students"
    ADD CONSTRAINT "classroom_students_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_students"
    ADD CONSTRAINT "classroom_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_chapters"
    ADD CONSTRAINT "course_chapters_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_lessons"
    ADD CONSTRAINT "course_lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."course_chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."course_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_recipient_groups"
    ADD CONSTRAINT "custom_recipient_groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fees_notifications"
    ADD CONSTRAINT "fees_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fees_payments"
    ADD CONSTRAINT "fees_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fees"
    ADD CONSTRAINT "fees_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_student_overrides"
    ADD CONSTRAINT "session_student_overrides_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_student_overrides"
    ADD CONSTRAINT "session_student_overrides_target_classroom_id_fkey" FOREIGN KEY ("target_classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attempts"
    ADD CONSTRAINT "task_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attempts"
    ADD CONSTRAINT "task_attempts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_inventory"
    ADD CONSTRAINT "task_inventory_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_inventory"
    ADD CONSTRAINT "task_inventory_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_class_students"
    ADD CONSTRAINT "temporary_class_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_class_students"
    ADD CONSTRAINT "temporary_class_students_temporary_class_id_fkey" FOREIGN KEY ("temporary_class_id") REFERENCES "public"."temporary_classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_classes"
    ADD CONSTRAINT "temporary_classes_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temporary_classes"
    ADD CONSTRAINT "temporary_classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can manage classrooms" ON "public"."classrooms" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Allow all assignment_students" ON "public"."assignment_students" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all assignments" ON "public"."assignments" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all attendance" ON "public"."attendance" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all batch_schedules" ON "public"."batch_schedules" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all broadcasts" ON "public"."broadcasts" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all class_notes" ON "public"."class_notes" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all classroom_inventory_allocation" ON "public"."classroom_inventory_allocation" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all classroom_session_logs" ON "public"."classroom_session_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all classroom_students" ON "public"."classroom_students" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all course_categories" ON "public"."course_categories" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all course_chapters" ON "public"."course_chapters" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all course_lessons" ON "public"."course_lessons" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all course_modules" ON "public"."course_modules" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all custom_recipient_groups" ON "public"."custom_recipient_groups" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all fees_notifications" ON "public"."fees_notifications" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all fees_payments" ON "public"."fees_payments" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon on blog_posts" ON "public"."blog_posts" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon on events" ON "public"."events" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon on gallery_items" ON "public"."gallery_items" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for anon on testimonials" ON "public"."testimonials" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all message_templates" ON "public"."message_templates" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all session_student_overrides" ON "public"."session_student_overrides" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all student_topic_progress" ON "public"."student_topic_progress" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all temporary_classes" ON "public"."temporary_classes" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated access to temporary_class_students" ON "public"."temporary_class_students" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read classrooms" ON "public"."classrooms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public insert for inquiries" ON "public"."inquiries" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read for blog_posts" ON "public"."blog_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Allow public read for events" ON "public"."events" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Allow public read for gallery_items" ON "public"."gallery_items" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Allow public read for testimonials" ON "public"."testimonials" FOR SELECT USING (true);



CREATE POLICY "Allow students to read their own classroom mapping" ON "public"."classroom_students" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Authenticated users can delete any user row" ON "public"."users" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert any user row" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read classrooms" ON "public"."classrooms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update any user row" ON "public"."users" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Students can submit tasks" ON "public"."task_attempts" FOR INSERT WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Students can view their submissions" ON "public"."task_attempts" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Students view enrolled classrooms" ON "public"."classrooms" FOR SELECT USING (("id" IN ( SELECT "classroom_students"."classroom_id"
   FROM "public"."classroom_students"
  WHERE ("classroom_students"."student_id" = "auth"."uid"()))));



CREATE POLICY "Teacher manages batch schedules" ON "public"."batch_schedules" USING (("classroom_id" IN ( SELECT "classrooms"."id"
   FROM "public"."classrooms"
  WHERE ("classrooms"."teacher_id" = "auth"."uid"()))));



CREATE POLICY "Teacher manages temp classes" ON "public"."temporary_classes" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete own classrooms" ON "public"."classrooms" FOR DELETE TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete their own classrooms" ON "public"."classrooms" FOR DELETE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert classrooms" ON "public"."classrooms" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'teacher'::"text")))));



CREATE POLICY "Teachers can manage all attendance" ON "public"."attendance" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Teachers can manage batch schedules for their classrooms" ON "public"."batch_schedules" USING ("public"."owns_classroom"("classroom_id", "auth"."uid"()));



CREATE POLICY "Teachers can manage students for their temporary classes" ON "public"."temporary_class_students" USING ((EXISTS ( SELECT 1
   FROM "public"."temporary_classes"
  WHERE (("temporary_classes"."id" = "temporary_class_students"."temporary_class_id") AND ("temporary_classes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can manage students in their classrooms" ON "public"."classroom_students" USING ("public"."owns_classroom"("classroom_id", "auth"."uid"()));



CREATE POLICY "Teachers can manage their own classrooms" ON "public"."classrooms" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can manage their own temporary classes" ON "public"."temporary_classes" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update own classrooms" ON "public"."classrooms" FOR UPDATE TO "authenticated" USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can update their own classrooms" ON "public"."classrooms" FOR UPDATE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view class sessions" ON "public"."class_sessions" FOR SELECT USING ("public"."owns_classroom"("classroom_id", "auth"."uid"()));



CREATE POLICY "Teachers can view classroom members" ON "public"."classroom_students" FOR SELECT USING ("public"."owns_classroom"("classroom_id", "auth"."uid"()));



CREATE POLICY "Teachers can view student attendance" ON "public"."attendance" FOR SELECT USING ("public"."is_teacher_of_student"("student_id", "auth"."uid"()));



CREATE POLICY "Teachers can view student profile info" ON "public"."users" FOR SELECT USING ((("teacher_id" = "auth"."uid"()) AND ("role" = 'student'::"text")));



CREATE POLICY "Teachers can view task attempts for their students" ON "public"."submissions" FOR SELECT USING ("public"."is_teacher_of_student"("student_id", "auth"."uid"()));



CREATE POLICY "Teachers can view task attempts for their students" ON "public"."task_attempts" FOR SELECT USING ("public"."is_teacher_of_student"("student_id", "auth"."uid"()));



CREATE POLICY "Teachers can view their own classrooms" ON "public"."classrooms" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers view their classroom tasks" ON "public"."tasks" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."assignment_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_inventory_allocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_session_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classrooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_recipient_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fees_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fees_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gallery_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_student_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_topic_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temporary_class_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temporary_classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_role_student"("u_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_role_student"("u_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_role_student"("u_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_teacher_of_student"("s_id" "uuid", "t_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_teacher_of_student"("s_id" "uuid", "t_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_teacher_of_student"("s_id" "uuid", "t_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."owns_classroom"("c_id" "uuid", "t_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."owns_classroom"("c_id" "uuid", "t_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_classroom"("c_id" "uuid", "t_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_classroom_teacher_to_students"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_classroom_teacher_to_students"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_classroom_teacher_to_students"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_student_teacher_on_enrollment"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_student_teacher_on_enrollment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_student_teacher_on_enrollment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_prepaid_classes_on_attendance"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_prepaid_classes_on_attendance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_prepaid_classes_on_attendance"() TO "service_role";


















GRANT ALL ON TABLE "public"."assignment_students" TO "anon";
GRANT ALL ON TABLE "public"."assignment_students" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_students" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."attempt_files" TO "anon";
GRANT ALL ON TABLE "public"."attempt_files" TO "authenticated";
GRANT ALL ON TABLE "public"."attempt_files" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."batch_schedules" TO "anon";
GRANT ALL ON TABLE "public"."batch_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."class_notes" TO "anon";
GRANT ALL ON TABLE "public"."class_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."class_notes" TO "service_role";



GRANT ALL ON TABLE "public"."class_sessions" TO "anon";
GRANT ALL ON TABLE "public"."class_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."class_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_inventory_allocation" TO "anon";
GRANT ALL ON TABLE "public"."classroom_inventory_allocation" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_inventory_allocation" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_session_logs" TO "anon";
GRANT ALL ON TABLE "public"."classroom_session_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_session_logs" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_students" TO "anon";
GRANT ALL ON TABLE "public"."classroom_students" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_students" TO "service_role";



GRANT ALL ON TABLE "public"."classrooms" TO "anon";
GRANT ALL ON TABLE "public"."classrooms" TO "authenticated";
GRANT ALL ON TABLE "public"."classrooms" TO "service_role";



GRANT ALL ON TABLE "public"."course_categories" TO "anon";
GRANT ALL ON TABLE "public"."course_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."course_categories" TO "service_role";



GRANT ALL ON TABLE "public"."course_chapters" TO "anon";
GRANT ALL ON TABLE "public"."course_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."course_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."course_lessons" TO "anon";
GRANT ALL ON TABLE "public"."course_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."course_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."course_modules" TO "anon";
GRANT ALL ON TABLE "public"."course_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."course_modules" TO "service_role";



GRANT ALL ON TABLE "public"."custom_recipient_groups" TO "anon";
GRANT ALL ON TABLE "public"."custom_recipient_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_recipient_groups" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."fees" TO "anon";
GRANT ALL ON TABLE "public"."fees" TO "authenticated";
GRANT ALL ON TABLE "public"."fees" TO "service_role";



GRANT ALL ON TABLE "public"."fees_notifications" TO "anon";
GRANT ALL ON TABLE "public"."fees_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."fees_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."fees_payments" TO "anon";
GRANT ALL ON TABLE "public"."fees_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."fees_payments" TO "service_role";



GRANT ALL ON TABLE "public"."gallery_items" TO "anon";
GRANT ALL ON TABLE "public"."gallery_items" TO "authenticated";
GRANT ALL ON TABLE "public"."gallery_items" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_categories" TO "anon";
GRANT ALL ON TABLE "public"."inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."message_templates" TO "anon";
GRANT ALL ON TABLE "public"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."session_student_overrides" TO "anon";
GRANT ALL ON TABLE "public"."session_student_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."session_student_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."student_topic_progress" TO "anon";
GRANT ALL ON TABLE "public"."student_topic_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_topic_progress" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."task_attempts" TO "anon";
GRANT ALL ON TABLE "public"."task_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."task_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."task_inventory" TO "anon";
GRANT ALL ON TABLE "public"."task_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."task_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."temporary_class_students" TO "anon";
GRANT ALL ON TABLE "public"."temporary_class_students" TO "authenticated";
GRANT ALL ON TABLE "public"."temporary_class_students" TO "service_role";



GRANT ALL ON TABLE "public"."temporary_classes" TO "anon";
GRANT ALL ON TABLE "public"."temporary_classes" TO "authenticated";
GRANT ALL ON TABLE "public"."temporary_classes" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_student_serial_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_student_serial_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_student_serial_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































