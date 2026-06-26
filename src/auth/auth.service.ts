import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserStatus } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already exists');
      }
      throw new ConflictException('Username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.usersRepository.create({
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      passwordHash,
      phone: dto.phone,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      address: dto.address,
      medicalNote: dto.medicalNote,
    });

    await this.usersRepository.save(user);
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.usersRepository.update(user.id, {
      lastLoginAt: new Date(),
    });
    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
      withDeleted: true,
    });
    if (!user) return null;
    if (user.deletedAt) return null;
    if (user.status === ('BLOCKED' as unknown as UserStatus)) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    return user;
  }

  async refresh(refreshToken: string) {
    const storedToken = await this.refreshTokensRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    await this.refreshTokensRepository.update(storedToken.id, {
      isRevoked: true,
    });

    return this.generateTokens(storedToken.user);
  }

  async logout(refreshToken: string) {
    const storedToken = await this.refreshTokensRepository.findOne({
      where: { token: refreshToken },
    });
    if (storedToken) {
      await this.refreshTokensRepository.update(storedToken.id, {
        isRevoked: true,
      });
    }
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepository.update(userId, { passwordHash });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: 'If the email exists, a password reset OTP has been sent.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.passwordResetRepository.save({
      userId: user.id,
      otp,
      expiresAt,
    });

    try {
      await this.mailService.sendMail(
        user.email,
        'Đặt lại mật khẩu',
        this.mailService.buildOtpEmail(otp),
      );
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${user.email}`, error);
    }

    return { message: 'If the email exists, a password reset OTP has been sent.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid email or OTP');
    }

    const passwordReset = await this.passwordResetRepository.findOne({
      where: { userId: user.id, otp: dto.otp, isUsed: false },
    });

    if (!passwordReset) {
      throw new BadRequestException('Invalid email or OTP');
    }

    if (new Date() > passwordReset.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const token = uuidv4();
    const tokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.passwordResetRepository.update(passwordReset.id, {
      isUsed: true,
      token,
      tokenExpiresAt,
    });

    return { token };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordReset = await this.passwordResetRepository.findOne({
      where: { token: dto.token },
      relations: ['user'],
    });

    if (!passwordReset) {
      throw new BadRequestException('Invalid reset token');
    }

    if (!passwordReset.tokenExpiresAt || new Date() > passwordReset.tokenExpiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.usersRepository.update(passwordReset.userId, { passwordHash });

    await this.refreshTokensRepository.update(
      { userId: passwordReset.userId },
      { isRevoked: true },
    );

    return { message: 'Password reset successfully' };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload); // create access token

    const refreshTokenValue = uuidv4(); // random UUID string
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + parseInt(refreshExpiresIn, 10) || 7,
    );

    await this.refreshTokensRepository.save({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        medicalNote: user.medicalNote,
      },
    };
  }
}
