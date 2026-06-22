import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum UserGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'full_name',
    length: 100,
  })
  fullName!: string;

  @Column({
    length: 50,
    unique: true,
  })
  username!: string;

  @Column({
    length: 255,
    unique: true,
  })
  email!: string;

  @Column({
    length: 20,
    unique: true,
    nullable: true,
  })
  phone?: string;

  @Column({
    name: 'password_hash',
    length: 255,
  })
  @Exclude({ toPlainOnly: true })
  passwordHash!: string;

  @Column({
    name: 'date_of_birth',
    type: 'date',
    nullable: true,
  })
  dateOfBirth?: string;

  @Column({
    type: 'enum',
    enum: UserGender,
    nullable: true,
  })
  gender?: UserGender;

  @Column({
    type: 'text',
    nullable: true,
  })
  address?: string;

  @Column({
    name: 'avatar_url',
    type: 'text',
    nullable: true,
  })
  avatarUrl?: string;

  @Column({
    name: 'medical_note',
    type: 'text',
    nullable: true,
  })
  medicalNote?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status?: UserStatus;

  @Column({
    name: 'email_verified',
    default: false,
  })
  emailVerified?: boolean;

  @Column({
    name: 'email_verified_at',
    type: 'timestamp',
    nullable: true,
  })
  emailVerifiedAt?: Date;

  @Column({
    name: 'last_login_at',
    type: 'timestamp',
    nullable: true,
  })
  lastLoginAt?: Date;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
  })
  deletedAt?: Date;
}
