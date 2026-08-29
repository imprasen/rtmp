# ARU Platform — Data Mitigation & Disaster Recovery

## 1. Overview
This document outlines strategies for data backup, recovery, and migration for the ARU platform. The platform stores data in two primary systems:
- **MongoDB** — Application data (users, tenants, missions, layers, etc.)
- **MinIO** — Binary/media files (raster images, video, GeoJSON, documents)

## 2. Current State Assessment

### What Exists
- Database seed script (`mongo-init.js`) for initial setup
- Docker volumes for data persistence (`mongodb`, `mediastore`, `letsencrypt`)
- K8s PersistentVolumeClaims for production (`mongo-claim.yaml`, `minio-claim.yaml`, `minio-volumes.yaml`)
- K8s backup pod configuration (`mgob.yaml`) — indicates MongoDB backup was considered

### What is Missing
- No automated backup scripts in the repository
- No documented backup schedule
- No tested restore procedures
- No data migration tools
- No database versioning/migration framework (e.g., no Prisma, Flyway, etc.)
- No replication configured for MongoDB

## 3. MongoDB Backup Strategy

### 3.1 Full Database Backup
```bash
# Docker Compose environment
docker exec mongodb mongodump --db test --out /data/backup/$(date +%Y%m%d)

# Copy backup from container
docker cp mongodb:/data/backup ./backups/
```

### 3.2 Scheduled Backups
Provide a cron job example:
```bash
# Add to crontab: Daily backup at 2 AM
0 2 * * * docker exec mongodb mongodump --db test --out /data/backup/$(date +\%Y\%m\%d) --gzip
```

### 3.3 Database Restore
```bash
# Restore from backup
docker exec -i mongodb mongorestore --db test --drop /data/backup/YYYYMMDD/test/
```

### 3.4 Point-in-Time Recovery
MongoDB supports oplog-based Point-in-Time Recovery (PITR) but requires replica set configuration. Currently, the deployment uses a standalone MongoDB instance.

**Recommendation:** Configure MongoDB as a single-node replica set to enable oplog for PITR.

## 4. MinIO Backup Strategy

### 4.1 Full Bucket Backup
```bash
# Using MinIO Client (mc)
mc alias set aru http://localhost:9000 minioadmin minioadmin
mc mirror aru/aru ./backups/minio/aru/
```

### 4.2 Incremental Backup
```bash
# Only copy changed files
mc mirror --overwrite --newer-than 24h aru/aru ./backups/minio/aru/
```

### 4.3 Restore MinIO Data
```bash
mc mirror ./backups/minio/aru/ aru/aru
```

## 5. Server Migration Strategy

Step-by-step process to migrate to a new server:

### 5.1 Pre-Migration
1. Full MongoDB backup (`mongodump`)
2. Full MinIO backup (`mc mirror`)
3. Export K8s configurations
4. Document all environment variables
5. Export Docker images or rebuild from source

### 5.2 New Server Setup
1. Install Docker, Docker Compose, kubectl
2. Clone source code repository
3. Configure `.env` files
4. Build all Docker images
5. Start services via docker-compose or K8s
6. Restore MongoDB from backup
7. Restore MinIO from backup
8. Verify all services are healthy
9. Update DNS/static IP pointing
10. Update firewall rules

### 5.3 Post-Migration Verification
- Verify login functionality
- Verify map rendering and layer display
- Verify video playback
- Verify live stream connectivity
- Verify AI inference pipeline
- Verify report generation

## 6. Data Volume Estimates

| Data Type | Storage Location | Growth Rate | Retention Policy |
| :--- | :--- | :--- | :--- |
| User/Tenant data | MongoDB | Low (KB/day) | Indefinite |
| GIS Layers (GeoJSON) | MinIO | Medium (MB/mission) | Indefinite |
| Raster Images (GeoTIFF) | MinIO | High (GB/mission) | Indefinite — can exceed 100GB per layer |
| Video (VOD) | MinIO | High (GB/flight) | [PLACEHOLDER: Define retention] |
| Live Stream Recordings | MinIO (via rclone) | High | [PLACEHOLDER: Define retention] |
| Reports | MinIO | Low (MB/report) | Indefinite |
| Sessions | MongoDB | Minimal (auto-expire 2hr) | Auto-purged |
| Logs (Seq) | Docker volume | Medium | [PLACEHOLDER: Define rotation] |

## 7. Data Integrity Considerations

- **Referential integrity**: MongoDB is schema-less; referential integrity is enforced at the application layer via Mongoose schemas. There are no database-level foreign key constraints.
- **Orphaned data risk**: If a mission is deleted, associated flights, layers, VODs, and documents may become orphaned if cascade delete is not implemented.
- **File-database consistency**: Files in MinIO and their metadata in MongoDB can become inconsistent if one is modified without the other.

## 8. Recommendations

1. Implement automated daily backups for both MongoDB and MinIO
2. Configure MongoDB replica set (even single-node) for oplog/PITR
3. Create a backup verification script that tests restore periodically
4. Implement a data retention policy for videos and live stream recordings
5. Add application-level cascade delete for mission hierarchies
6. Consider migrating to MongoDB Atlas or a managed database service for automatic backups
7. Set up offsite/remote backup storage
8. Document and test the full disaster recovery procedure quarterly
