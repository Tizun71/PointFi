// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseTest.sol";

contract RepaymentTest is BaseTest {
    
    function _setupApprovedLoan() internal returns (uint256) {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(borrower);
        uint256 loanId = loanManager.requestLoan(2 ether);
        
        (, , , , , , bytes32 requestId) = loanManager.loans(loanId);
        
        mockRouter.fulfillRequest(
            address(creditOracle),
            requestId,
            abi.encode(uint256(750)),
            new bytes(0)
        );
        
        return loanId;
    }
    
    function testRepayLoan() public {
        uint256 loanId = _setupApprovedLoan();
        
        vm.warp(block.timestamp + 30 days);
        
        (uint256 totalRepayment, , uint256 interest) = loanManager.calculateRepayment(loanId);
        
        uint256 numerator = 2 ether * 5 * 30;
        uint256 expectedInterest = numerator / 100 / 365;
        assertEq(interest, expectedInterest);
        
        vm.prank(borrower);
        loanManager.repayLoan{value: totalRepayment}(loanId);
        
        (, , , , bool repaid, , ) = loanManager.loans(loanId);
        assertTrue(repaid);
        
        assertEq(lendingPool.totalLiquidity(), 10 ether + interest);
    }
    
    function testCannotRepayTwice() public {
        uint256 loanId = _setupApprovedLoan();
        
        (uint256 totalRepayment, , ) = loanManager.calculateRepayment(loanId);
        
        vm.startPrank(borrower);
        loanManager.repayLoan{value: totalRepayment}(loanId);
        
        vm.expectRevert();
        loanManager.repayLoan{value: totalRepayment}(loanId);
        vm.stopPrank();
    }
    
    function testCannotRepayInsufficientAmount() public {
        uint256 loanId = _setupApprovedLoan();
        
        (uint256 totalRepayment, , ) = loanManager.calculateRepayment(loanId);
        
        vm.prank(borrower);
        vm.expectRevert();
        loanManager.repayLoan{value: totalRepayment - 0.1 ether}(loanId);
    }
}
