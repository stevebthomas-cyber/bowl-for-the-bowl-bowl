-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: leagues; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: assistant_coach_config; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: award_votes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: awards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: venues; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pitches; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bounties; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: guest_coach_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: match_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: match_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: match_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: player_of_week_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: roster_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: roster_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: season_archives; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sob_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sob_achievements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sob_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: team_ownership; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: visitor_teams; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict KcBxTKl25irJKDIvLIsXtkj5DIzE6rB8JthpnKkemKFQtES3rLEBholbyrXJUCZ

RESET ALL;
