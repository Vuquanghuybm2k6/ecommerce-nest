import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({length: 255,})
  name!: string;

  @Column({type: 'text',nullable: true,})
  description?: string;

  @Column({type: 'decimal',precision: 10,scale: 2,})
  price!: number;

  @Column({default: 0,})
  stock!: number;

  @Column({type: 'decimal',precision: 5,scale: 2,default: 0,})
  discount?: number;

  @Column({length: 100,unique: true,nullable: true})
  sku?: string;

  @Column({name: 'image_url',type: 'text',nullable: true,})
  imageUrl?: string;

  @Column({name: 'is_active',default: true,})
  isActive?: boolean;

  @Column({name: 'is_deleted',default: false,})
  isDeleted?: boolean;

  @CreateDateColumn({name: 'created_at'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at',})
  updatedAt!: Date;
}